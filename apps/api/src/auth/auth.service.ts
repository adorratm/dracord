import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { EntityManager } from 'typeorm';
import type { AuthTokens } from '@dracord/types';
import { Account } from '../database/entities/account.entity';
import { Guild } from '../database/entities/guild.entity';
import { GuildMember } from '../database/entities/guild-member.entity';
import { Session } from '../database/entities/session.entity';
import { User } from '../database/entities/user.entity';
import { AuthProvider, UserStatus } from '../database/enums';
import type { AppleAuthDto } from './dto/apple-auth.dto';
import type { DevLoginDto } from './dto/dev-login.dto';
import type { GoogleProfile } from './strategies/google.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async devLogin(dto: DevLoginDto): Promise<AuthTokens & { user: User }> {
    const usernameRaw = dto.username?.trim() || 'vampiredev';
    const username = usernameRaw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const email = (dto.email ?? `${username}@dracord.local`).toLowerCase();
    const displayName = dto.displayName ?? dto.username ?? 'VampireDev';
    const password = dto.password ?? 'dev-password';
    const passwordHash = await bcrypt.hash(password, 10);

    const existing =
      (await this.em.findOne(User, { where: { email } })) ??
      (await this.em.findOne(User, { where: { username } }));

    let user: User;
    if (existing) {
      existing.displayName = displayName;
      existing.passwordHash = passwordHash;
      existing.status = UserStatus.ONLINE;
      user = await this.em.save(User, existing);
    } else {
      user = await this.em.save(
        User,
        this.em.create(User, {
          email,
          username,
          displayName,
          passwordHash,
        }),
      );
      await this.em.save(
        Account,
        this.em.create(Account, {
          userId: user.id,
          provider: AuthProvider.DEV,
          providerAccountId: `dev-${username}`,
        }),
      );
    }

    const seedGuild = await this.em.findOne(Guild, {
      where: { id: 'seed-dracula-realm' },
    });
    if (seedGuild) {
      const membership = await this.em.findOne(GuildMember, {
        where: { guildId: seedGuild.id, userId: user.id },
      });
      if (!membership) {
        await this.em.save(
          GuildMember,
          this.em.create(GuildMember, {
            guildId: seedGuild.id,
            userId: user.id,
          }),
        );
      }
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  async loginWithOAuthProfile(
    provider: AuthProvider,
    profile: {
      providerAccountId: string;
      email: string;
      username: string;
      displayName: string;
    },
  ): Promise<AuthTokens & { user: User }> {
    const account = await this.em.findOne(Account, {
      where: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
      relations: { user: true },
    });

    let user = account?.user;

    if (!user) {
      const existingByEmail = await this.em.findOne(User, {
        where: { email: profile.email.toLowerCase() },
      });
      if (existingByEmail) {
        user = existingByEmail;
        await this.em.save(
          Account,
          this.em.create(Account, {
            userId: user.id,
            provider,
            providerAccountId: profile.providerAccountId,
          }),
        );
      } else {
        let username = profile.username.toLowerCase();
        const taken = await this.em.findOne(User, { where: { username } });
        if (taken) {
          username = `${username}${randomBytes(2).toString('hex')}`;
        }
        user = await this.em.save(
          User,
          this.em.create(User, {
            email: profile.email.toLowerCase(),
            username,
            displayName: profile.displayName,
          }),
        );
        await this.em.save(
          Account,
          this.em.create(Account, {
            userId: user.id,
            provider,
            providerAccountId: profile.providerAccountId,
          }),
        );
      }
    }

    const tokens = await this.issueTokens(user);
    await this.ensureSeedGuildMembership(user.id);
    return { ...tokens, user };
  }

  private async ensureSeedGuildMembership(userId: string): Promise<void> {
    const seedGuild = await this.em.findOne(Guild, {
      where: { id: 'seed-dracula-realm' },
    });
    if (!seedGuild) return;
    const membership = await this.em.findOne(GuildMember, {
      where: { guildId: seedGuild.id, userId },
    });
    if (!membership) {
      await this.em.save(
        GuildMember,
        this.em.create(GuildMember, {
          guildId: seedGuild.id,
          userId,
        }),
      );
    }
  }

  async appleLogin(dto: AppleAuthDto): Promise<AuthTokens & { user: User }> {
    const appleClientId = this.config.get<string>('APPLE_CLIENT_ID');
    const stubMode =
      !appleClientId || this.config.get<string>('APPLE_STUB_MODE') === 'true';

    if (!stubMode) {
      throw new BadRequestException(
        'Apple Sign In production verification is not configured in this build.',
      );
    }

    const stubId = dto.idToken.slice(0, 64) || randomBytes(8).toString('hex');
    const email =
      dto.email?.toLowerCase() ?? `apple-${stubId.slice(0, 8)}@stub.dracord.local`;
    const displayName = dto.displayName ?? 'Apple User';

    return this.loginWithOAuthProfile(AuthProvider.APPLE, {
      providerAccountId: stubId,
      email,
      username: email.split('@')[0]!,
      displayName,
    });
  }

  async googleCallback(profile: GoogleProfile): Promise<AuthTokens & { user: User }> {
    return this.loginWithOAuthProfile(AuthProvider.GOOGLE, profile);
  }

  async refreshTokens(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    const session = await this.em.findOne(Session, {
      where: { id: sessionId, userId },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh session');
    }
    const valid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    await this.em.delete(Session, session.id);
    return this.issueTokens(user);
  }

  async getUserById(userId: string): Promise<User> {
    return this.em.findOneOrFail(User, { where: { id: userId } });
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const sessionId = randomBytes(16).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const refreshExpires = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const expiresAt = this.addDuration(new Date(), refreshExpires);

    await this.em.save(
      Session,
      this.em.create(Session, {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        expiresAt,
      }),
    );

    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExpires = (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      '15m') as JwtSignOptions['expiresIn'];
    const refreshExpiresIn = refreshExpires as JwtSignOptions['expiresIn'];

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
      },
      { secret: accessSecret, expiresIn: accessExpires },
    );

    const signedRefresh = await this.jwt.signAsync(
      { sub: user.id, sessionId },
      { secret: refreshSecret, expiresIn: refreshExpiresIn },
    );

    return {
      accessToken,
      refreshToken: `${signedRefresh}.${refreshToken}`,
    };
  }

  private addDuration(from: Date, duration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    const value = Number(match[1]);
    const unit = match[2];
    const ms =
      unit === 's'
        ? value * 1000
        : unit === 'm'
          ? value * 60 * 1000
          : unit === 'h'
            ? value * 60 * 60 * 1000
            : value * 24 * 60 * 60 * 1000;
    return new Date(from.getTime() + ms);
  }

  parseRefreshToken(combined: string): { signed: string; raw: string } {
    const parts = combined.split('.');
    if (parts.length < 4) {
      throw new UnauthorizedException('Malformed refresh token');
    }
    return {
      signed: parts.slice(0, -1).join('.'),
      raw: parts[parts.length - 1]!,
    };
  }
}
