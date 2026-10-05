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
import { Account } from '@/database/entities/account.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Session } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { AuthProvider, UserStatus } from '@/database/enums';
import type { AppleAuthDto } from '@/auth/dto/apple-auth.dto';
import type { DevLoginDto } from '@/auth/dto/dev-login.dto';
import type { GoogleProfile } from '@/auth/strategies/google.strategy';
import {
  isAdminEmail,
  parseAdminEmails,
} from '@/auth/admin-emails';
import {
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  totpOtpauthUrl,
  verifyTotpCode,
} from '@/common/totp';

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  assertAdminEmail(email: string | null | undefined): void {
    if (!isAdminEmail(this.config, email)) {
      throw new UnauthorizedException(
        'Bu hesap admin paneline giriş yapamaz',
      );
    }
  }

  listAdminEmails(): string[] {
    return parseAdminEmails(this.config);
  }

  async issueLoginOrChallenge(
    user: User,
  ): Promise<
    | (AuthTokens & { user: User; requires2fa?: false })
    | { requires2fa: true; challengeToken: string; user: User }
  > {
    if (user.totpEnabled && user.totpSecret) {
      const challengeToken = await this.issue2faChallenge(user.id);
      return { requires2fa: true, challengeToken, user };
    }
    const tokens = await this.issueTokens(user);
    return { ...tokens, user, requires2fa: false };
  }

  private async issue2faChallenge(userId: string): Promise<string> {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return this.jwt.signAsync(
      { sub: userId, purpose: '2fa' },
      { secret, expiresIn: '10m' },
    );
  }

  async verify2faChallenge(
    challengeToken: string,
    code: string,
  ): Promise<AuthTokens & { user: User }> {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    let payload: { sub?: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(challengeToken, { secret });
    } catch {
      throw new UnauthorizedException('2FA oturumu süresi doldu');
    }
    if (payload.purpose !== '2fa' || !payload.sub) {
      throw new UnauthorizedException('Geçersiz 2FA oturumu');
    }
    const user = await this.getUserById(payload.sub);
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA bu hesapta açık değil');
    }
    const totpOk = verifyTotpCode(user.totpSecret, code);
    const recoveryOk = totpOk ? false : await this.consumeRecoveryCode(user, code);
    if (!totpOk && !recoveryOk) {
      throw new UnauthorizedException('Doğrulama kodu hatalı');
    }
    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  async get2faStatus(userId: string): Promise<{
    enabled: boolean;
    recoveryRemaining: number;
  }> {
    const user = await this.getUserById(userId);
    return {
      enabled: Boolean(user.totpEnabled),
      recoveryRemaining: user.totpRecoveryHashes?.length ?? 0,
    };
  }

  async begin2faSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.getUserById(userId);
    if (user.totpEnabled) {
      throw new BadRequestException('2FA zaten açık');
    }
    const secret = generateTotpSecret();
    user.totpSecret = secret;
    user.totpEnabled = false;
    await this.em.save(User, user);
    return {
      secret,
      otpauthUrl: totpOtpauthUrl(secret, user.email || user.username),
    };
  }

  async confirm2faSetup(
    userId: string,
    code: string,
  ): Promise<{ enabled: true; recoveryCodes: string[] }> {
    const user = await this.getUserById(userId);
    if (!user.totpSecret) {
      throw new BadRequestException('Önce 2FA kurulumunu başlat');
    }
    if (user.totpEnabled) {
      return { enabled: true, recoveryCodes: [] };
    }
    if (!verifyTotpCode(user.totpSecret, code)) {
      throw new UnauthorizedException('Doğrulama kodu hatalı');
    }
    const recoveryCodes = generateRecoveryCodes(8);
    user.totpEnabled = true;
    user.totpRecoveryHashes = await Promise.all(
      recoveryCodes.map((c) => bcrypt.hash(normalizeRecoveryCode(c), 10)),
    );
    await this.em.save(User, user);
    return { enabled: true, recoveryCodes };
  }

  async regenerateRecoveryCodes(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.getUserById(userId);
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA kapalı');
    }
    const totpOk = verifyTotpCode(user.totpSecret, code);
    if (!totpOk) {
      throw new UnauthorizedException('Doğrulama kodu hatalı');
    }
    const recoveryCodes = generateRecoveryCodes(8);
    user.totpRecoveryHashes = await Promise.all(
      recoveryCodes.map((c) => bcrypt.hash(normalizeRecoveryCode(c), 10)),
    );
    await this.em.save(User, user);
    return { recoveryCodes };
  }

  private async consumeRecoveryCode(user: User, code: string): Promise<boolean> {
    const hashes = user.totpRecoveryHashes ?? [];
    if (!hashes.length) return false;
    const normalized = normalizeRecoveryCode(code);
    if (normalized.length < 8) return false;
    for (let i = 0; i < hashes.length; i++) {
      const ok = await bcrypt.compare(normalized, hashes[i]!);
      if (ok) {
        user.totpRecoveryHashes = hashes.filter((_, idx) => idx !== i);
        await this.em.save(User, user);
        return true;
      }
    }
    return false;
  }

  async disable2fa(
    userId: string,
    opts: { code?: string; password?: string },
  ): Promise<{ enabled: false }> {
    const user = await this.getUserById(userId);
    if (!user.totpEnabled) {
      user.totpSecret = null;
      user.totpRecoveryHashes = null;
      await this.em.save(User, user);
      return { enabled: false };
    }
    if (opts.code) {
      const totpOk =
        Boolean(user.totpSecret) && verifyTotpCode(user.totpSecret!, opts.code);
      const recoveryOk = totpOk ? false : await this.consumeRecoveryCode(user, opts.code);
      if (!totpOk && !recoveryOk) {
        throw new UnauthorizedException('Doğrulama kodu hatalı');
      }
    } else if (opts.password && user.passwordHash) {
      const ok = await bcrypt.compare(opts.password, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Şifre hatalı');
    } else {
      throw new BadRequestException('2FA kapatmak için kod veya şifre gerekli');
    }
    user.totpEnabled = false;
    user.totpSecret = null;
    user.totpRecoveryHashes = null;
    await this.em.save(User, user);
    return { enabled: false };
  }

  async cancel2faSetup(userId: string): Promise<{ ok: true }> {
    const user = await this.getUserById(userId);
    if (!user.totpEnabled) {
      user.totpSecret = null;
      await this.em.save(User, user);
    }
    return { ok: true };
  }

  async devLogin(dto: DevLoginDto): Promise<
    | (AuthTokens & { user: User; requires2fa?: false })
    | { requires2fa: true; challengeToken: string; user: User }
  > {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new UnauthorizedException('Dev login disabled');
    }
    if (this.config.get<string>('ENABLE_DEV_LOGIN') === 'false') {
      throw new UnauthorizedException('Dev login disabled');
    }
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
      existing.preferredStatus = UserStatus.ONLINE;
      existing.usernameConfirmed = true;
      user = await this.em.save(User, existing);
    } else {
      user = await this.em.save(
        User,
        this.em.create(User, {
          email,
          username,
          displayName,
          passwordHash,
          usernameConfirmed: true,
          status: UserStatus.ONLINE,
          preferredStatus: UserStatus.ONLINE,
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

    return this.issueLoginOrChallenge(user);
  }

  async loginWithOAuthProfile(
    provider: AuthProvider,
    profile: {
      providerAccountId: string;
      email: string;
      username: string;
      displayName: string;
    },
  ): Promise<
    | (AuthTokens & { user: User; requires2fa?: false })
    | { requires2fa: true; challengeToken: string; user: User }
  > {
    const account = await this.em.findOne(Account, {
      where: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
      relations: { user: true },
    });

    let user = account?.user;
    let isBrandNew = false;

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
        isBrandNew = true;
        const username = await this.allocateUniqueUsername(profile.username);
        user = await this.em.save(
          User,
          this.em.create(User, {
            email: profile.email.toLowerCase(),
            username,
            displayName: profile.displayName,
            usernameConfirmed: false,
            status: UserStatus.ONLINE,
            preferredStatus: UserStatus.ONLINE,
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

    if (!isBrandNew && user.usernameConfirmed !== false) {
      await this.ensureSeedGuildMembership(user.id);
    }
    return this.issueLoginOrChallenge(user);
  }

  /** displayName / öneriden benzersiz kullanıcı adı üretir. */
  async allocateUniqueUsername(raw: string): Promise<string> {
    let base = raw
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 24);
    if (!base || base.length < 2) base = 'kullanici';
    let candidate = base;
    for (let i = 0; i < 20; i++) {
      const taken = await this.em.findOne(User, { where: { username: candidate } });
      if (!taken) return candidate;
      candidate = `${base}${randomBytes(2).toString('hex')}`.slice(0, 32);
    }
    return `${base}${Date.now().toString(36)}`.slice(0, 32);
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

  async appleLogin(dto: AppleAuthDto): Promise<
    | (AuthTokens & { user: User; requires2fa?: false })
    | { requires2fa: true; challengeToken: string; user: User }
  > {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const appleClientId = this.config.get<string>('APPLE_CLIENT_ID')?.trim();
    const stubRequested = this.config.get<string>('APPLE_STUB_MODE') === 'true';
    // Production’da stub asla; aksi halde sahte idToken ile hesap açılır
    const stubMode = !isProd && stubRequested && !appleClientId;

    if (!stubMode) {
      throw new UnauthorizedException('Apple Sign In is not available');
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

  async googleCallback(
    profile: GoogleProfile,
    options?: { admin?: boolean },
  ): Promise<
    | (AuthTokens & { user: User; requires2fa?: false })
    | { requires2fa: true; challengeToken: string; user: User }
  > {
    if (options?.admin) {
      this.assertAdminEmail(profile.email);
    }
    return this.loginWithOAuthProfile(AuthProvider.GOOGLE, profile);
  }

  async assertAdminUser(userId: string): Promise<User> {
    const user = await this.getUserById(userId);
    this.assertAdminEmail(user.email);
    return user;
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
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    if (user.disabledAt) {
      throw new UnauthorizedException('Hesap devre dışı');
    }
    return user;
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    if (user.disabledAt) {
      throw new UnauthorizedException('Hesap devre dışı. Yeniden etkinleştirmek için destekle iletişime geç.');
    }
    const sessionId = randomBytes(16).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const refreshExpires = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
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
      '7d') as JwtSignOptions['expiresIn'];
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
