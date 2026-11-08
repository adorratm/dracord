import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { EntityManager, In } from 'typeorm';
import {
  GAME_LIMITS,
  SocketEvents,
  type GameAppDto,
  type GameAppInput,
  type GameAppStatus,
  type GameLaunchDto,
  type GamePlatform,
  type GameSessionDto,
  type GameTokenClaims,
} from '@dracord/types';
import { PlatformAdminService } from '@/auth/platform-admin.service';
import { GameApp } from '@/database/entities/game-app.entity';
import { GameSession } from '@/database/entities/game-session.entity';
import { User } from '@/database/entities/user.entity';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { GuildsService } from '@/guilds/guilds.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { VoicePresenceService } from '@/voice/voice-presence.service';

const TOKEN_TTL_SEC = 10 * 60;
const PLATFORMS: GamePlatform[] = ['web', 'desktop', 'mobile'];

function sha256(v: string) {
  return createHash('sha256').update(v).digest('hex');
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Oyun platformu.
 * - Herkes oyun oluşturur (taslak), kendisi + testçiler sunucularında test eder.
 * - "İncelemeye gönder" → admin onaylar / reddeder / askıya alır.
 * - Yalnız onaylı oyunlar herkese görünür. Onaylı oyunun entryUrl'i değişirse yeniden incelemeye düşer.
 * - Oyun iframe'i kısa ömürlü token alır; oyun sunucusu POST /v1/games/verify ile doğrular.
 */
@Injectable()
export class GamesService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly guilds: GuildsService,
    private readonly voice: VoicePresenceService,
    private readonly broadcast: SocketBroadcastService,
    private readonly notifications: NotificationsService,
    private readonly notificationsRealtime: NotificationsRealtimeService,
    private readonly platformAdmin: PlatformAdminService,
  ) {}

  private tokenSecret(): string {
    return (
      this.config.get<string>('GAME_TOKEN_SECRET') ||
      `${this.config.getOrThrow<string>('JWT_ACCESS_SECRET')}:games`
    );
  }

  // ── DTO ──
  private toDto(g: GameApp, opts?: { owner?: boolean; ownerName?: string | null }): GameAppDto {
    return {
      id: g.id,
      slug: g.slug,
      name: g.name,
      shortDescription: g.shortDescription,
      description: g.description,
      iconUrl: g.iconUrl,
      coverUrl: g.coverUrl,
      entryUrl: g.entryUrl,
      minPlayers: g.minPlayers,
      maxPlayers: g.maxPlayers,
      orientation: g.orientation,
      platforms: g.platforms ?? ['web', 'desktop'],
      status: g.status,
      reviewNote: opts?.owner ? g.reviewNote : null,
      ownerUserId: g.ownerUserId,
      ownerName: opts?.ownerName ?? null,
      testerUserIds: opts?.owner ? g.testerUserIds ?? [] : undefined,
      secretLast4: opts?.owner ? g.secretLast4 : undefined,
      submittedAt: g.submittedAt?.toISOString() ?? null,
      reviewedAt: g.reviewedAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    };
  }

  private validateUrl(url: unknown, field: string, allowLocal: boolean): string {
    if (typeof url !== 'string' || !url.trim()) throw new BadRequestException(`${field} gerekli`);
    let u: URL;
    try {
      u = new URL(url.trim());
    } catch {
      throw new BadRequestException(`${field} geçerli bir adres değil`);
    }
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(allowLocal && local && u.protocol === 'http:')) {
      throw new BadRequestException(`${field} https olmalı (test için http://localhost olabilir)`);
    }
    if (u.username || u.password) throw new BadRequestException(`${field} kimlik bilgisi içeremez`);
    return u.toString();
  }

  private applyInput(g: GameApp, input: GameAppInput, isNew: boolean) {
    const str = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    if (input.name !== undefined || isNew) {
      const name = str(input.name, GAME_LIMITS.nameMax);
      if (name.length < 2) throw new BadRequestException('Oyun adı en az 2 karakter');
      g.name = name;
    }
    if (input.shortDescription !== undefined) g.shortDescription = str(input.shortDescription, GAME_LIMITS.shortMax);
    if (input.description !== undefined) g.description = String(input.description ?? '').slice(0, GAME_LIMITS.descMax);
    if (input.iconUrl !== undefined) g.iconUrl = input.iconUrl ? this.validateUrl(input.iconUrl, 'Simge', true) : null;
    if (input.coverUrl !== undefined) g.coverUrl = input.coverUrl ? this.validateUrl(input.coverUrl, 'Kapak', true) : null;
    if (input.entryUrl !== undefined || isNew) g.entryUrl = this.validateUrl(input.entryUrl, 'Oyun adresi', true);
    if (input.minPlayers !== undefined) g.minPlayers = Math.min(50, Math.max(1, Math.round(Number(input.minPlayers) || 1)));
    if (input.maxPlayers !== undefined) g.maxPlayers = Math.min(100, Math.max(1, Math.round(Number(input.maxPlayers) || 8)));
    if (g.maxPlayers < g.minPlayers) g.maxPlayers = g.minPlayers;
    if (input.orientation !== undefined) {
      g.orientation = (['any', 'landscape', 'portrait'] as const).includes(input.orientation) ? input.orientation : 'any';
    }
    if (input.platforms !== undefined) {
      const p = (Array.isArray(input.platforms) ? input.platforms : []).filter((x): x is GamePlatform => PLATFORMS.includes(x));
      g.platforms = p.length ? [...new Set(p)] : ['web', 'desktop'];
    }
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base) || 'oyun';
    for (let i = 0; i < 50; i++) {
      const cand = i === 0 ? root : `${root}-${i + 1}`.slice(0, 48);
      const hit = await this.em.findOne(GameApp, { where: { slug: cand } });
      if (!hit || hit.id === excludeId) return cand;
    }
    return `${root}-${randomBytes(3).toString('hex')}`.slice(0, 48);
  }

  private async ownGame(gameId: string, userId: string): Promise<GameApp> {
    const g = await this.em.findOne(GameApp, { where: { id: gameId } });
    if (!g) throw new NotFoundException('Oyun bulunamadı');
    if (g.ownerUserId !== userId) throw new ForbiddenException('Bu oyun senin değil');
    return g;
  }

  private newSecret(g: GameApp): string {
    const secret = `dgs_${randomBytes(24).toString('hex')}`;
    g.secretHash = sha256(secret);
    g.secretLast4 = secret.slice(-4);
    return secret;
  }

  // ── Geliştirici ──
  async listMine(userId: string): Promise<GameAppDto[]> {
    const rows = await this.em.find(GameApp, { where: { ownerUserId: userId }, order: { createdAt: 'DESC' } });
    return rows.map((g) => this.toDto(g, { owner: true }));
  }

  async create(userId: string, input: GameAppInput): Promise<{ game: GameAppDto; secret: string }> {
    const count = await this.em.count(GameApp, { where: { ownerUserId: userId } });
    if (count >= GAME_LIMITS.maxGamesPerDeveloper) {
      throw new BadRequestException(`En fazla ${GAME_LIMITS.maxGamesPerDeveloper} oyun oluşturabilirsin`);
    }
    const g = this.em.create(GameApp, {
      ownerUserId: userId,
      status: 'draft',
      testerUserIds: [],
      platforms: ['web', 'desktop'],
      minPlayers: 1,
      maxPlayers: 8,
      orientation: 'any',
      shortDescription: '',
      description: '',
    });
    this.applyInput(g, input, true);
    g.slug = await this.uniqueSlug(input.slug || g.name);
    const secret = this.newSecret(g);
    const saved = await this.em.save(GameApp, g);
    return { game: this.toDto(saved, { owner: true }), secret };
  }

  async update(gameId: string, userId: string, input: GameAppInput): Promise<GameAppDto> {
    const g = await this.ownGame(gameId, userId);
    if (g.status === 'suspended') throw new ForbiddenException('Askıya alınmış oyun düzenlenemez');
    const prevEntry = g.entryUrl;
    const prevName = g.name;
    this.applyInput(g, input, false);
    if (input.slug !== undefined && slugify(input.slug) !== g.slug) g.slug = await this.uniqueSlug(input.slug, g.id);
    // Onaylı oyunda adres/ad değişirse yeniden inceleme
    if (g.status === 'approved' && (g.entryUrl !== prevEntry || g.name !== prevName)) {
      g.status = 'in_review';
      g.submittedAt = new Date();
    }
    return this.toDto(await this.em.save(GameApp, g), { owner: true });
  }

  async remove(gameId: string, userId: string): Promise<{ ok: true }> {
    const g = await this.ownGame(gameId, userId);
    await this.em.update(GameSession, { gameId: g.id, status: 'active' }, { status: 'ended', endedAt: new Date() });
    await this.em.delete(GameApp, { id: g.id });
    return { ok: true };
  }

  async rotateSecret(gameId: string, userId: string): Promise<{ secret: string; secretLast4: string }> {
    const g = await this.ownGame(gameId, userId);
    const secret = this.newSecret(g);
    await this.em.save(GameApp, g);
    return { secret, secretLast4: g.secretLast4! };
  }

  async submit(gameId: string, userId: string): Promise<GameAppDto> {
    const g = await this.ownGame(gameId, userId);
    if (g.status === 'suspended') throw new ForbiddenException('Askıya alınmış oyun gönderilemez');
    if (g.status === 'approved') return this.toDto(g, { owner: true });
    if (!g.entryUrl.startsWith('https://')) throw new BadRequestException('Yayın için oyun adresi https olmalı');
    if (!g.shortDescription.trim()) throw new BadRequestException('Kısa açıklama gerekli');
    if (!g.iconUrl) throw new BadRequestException('Simge gerekli');
    g.status = 'in_review';
    g.submittedAt = new Date();
    g.reviewNote = null;
    return this.toDto(await this.em.save(GameApp, g), { owner: true });
  }

  async setTesters(gameId: string, userId: string, usernames: string[]): Promise<GameAppDto> {
    const g = await this.ownGame(gameId, userId);
    const names = [...new Set((usernames ?? []).map((u) => String(u).trim().replace(/^@/, '').toLowerCase()).filter(Boolean))].slice(
      0,
      GAME_LIMITS.maxTesters,
    );
    const users = names.length ? await this.em.find(User, { where: { username: In(names) } }) : [];
    g.testerUserIds = users.map((u) => u.id).filter((id) => id !== userId);
    return this.toDto(await this.em.save(GameApp, g), { owner: true });
  }

  // ── Katalog ──
  private canPlay(g: GameApp, userId: string): { ok: boolean; testMode: boolean } {
    if (g.status === 'approved') return { ok: true, testMode: false };
    if (g.status === 'suspended') return { ok: false, testMode: false };
    const tester = g.ownerUserId === userId || (g.testerUserIds ?? []).includes(userId);
    return { ok: tester, testMode: tester };
  }

  /** Onaylılar + kullanıcının test edebildikleri */
  async catalog(userId: string): Promise<Array<GameAppDto & { testMode: boolean }>> {
    const approved = await this.em.find(GameApp, { where: { status: 'approved' }, order: { name: 'ASC' }, take: 200 });
    const testable = await this.em
      .createQueryBuilder(GameApp, 'g')
      .where("g.status IN ('draft','in_review','rejected')")
      .andWhere('(g.ownerUserId = :u OR g.testerUserIds @> CAST(:arr AS jsonb))', { u: userId, arr: JSON.stringify([userId]) })
      .getMany();
    return [
      ...testable.map((g) => ({ ...this.toDto(g), testMode: true })),
      ...approved.map((g) => ({ ...this.toDto(g), testMode: false })),
    ];
  }

  // ── Oturumlar ──
  private sessionDto(s: GameSession, g: GameApp): GameSessionDto {
    return {
      id: s.id,
      gameId: s.gameId,
      game: {
        id: g.id,
        name: g.name,
        slug: g.slug,
        iconUrl: g.iconUrl,
        entryUrl: g.entryUrl,
        orientation: g.orientation,
        maxPlayers: g.maxPlayers,
        status: g.status,
      },
      guildId: s.guildId,
      channelId: s.channelId,
      hostUserId: s.hostUserId,
      participantIds: s.participantIds ?? [],
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    };
  }

  private emit(dto: GameSessionDto) {
    this.broadcast.emitToGuild(dto.guildId, SocketEvents.GAME_SESSION_UPDATE, dto);
  }

  private async assertInVoice(guildId: string, channelId: string, userId: string) {
    await this.guilds.ensureMember(guildId, userId);
    const members = await this.voice.listChannel(guildId, channelId);
    if (!members.some((m) => m.id === userId)) throw new ForbiddenException('Önce ses kanalına katıl');
  }

  async listChannelSessions(guildId: string, channelId: string, userId: string): Promise<GameSessionDto[]> {
    await this.guilds.ensureMember(guildId, userId);
    const rows = await this.em.find(GameSession, { where: { guildId, channelId, status: 'active' }, take: 10 });
    if (!rows.length) return [];
    const games = await this.em.find(GameApp, { where: { id: In(rows.map((r) => r.gameId)) } });
    const byId = new Map(games.map((g) => [g.id, g]));
    return rows.filter((r) => byId.has(r.gameId)).map((r) => this.sessionDto(r, byId.get(r.gameId)!));
  }

  /** Ses kanalında oyun başlat (aynı oyunun aktif oturumu varsa ona katılır) */
  async start(gameId: string, guildId: string, channelId: string, userId: string): Promise<GameSessionDto> {
    await this.assertInVoice(guildId, channelId, userId);
    const g = await this.em.findOne(GameApp, { where: { id: gameId } });
    if (!g) throw new NotFoundException('Oyun bulunamadı');
    if (!this.canPlay(g, userId).ok) throw new ForbiddenException('Bu oyun henüz yayında değil');
    const existing = await this.em.findOne(GameSession, { where: { gameId, guildId, channelId, status: 'active' } });
    if (existing) return this.join(existing.id, userId);
    const s = await this.em.save(
      GameSession,
      this.em.create(GameSession, { gameId, guildId, channelId, hostUserId: userId, participantIds: [userId], status: 'active' }),
    );
    const dto = this.sessionDto(s, g);
    this.emit(dto);
    return dto;
  }

  async join(sessionId: string, userId: string): Promise<GameSessionDto> {
    const s = await this.em.findOne(GameSession, { where: { id: sessionId } });
    if (!s || s.status !== 'active') throw new NotFoundException('Oyun oturumu bitti');
    await this.assertInVoice(s.guildId, s.channelId, userId);
    const g = await this.em.findOne(GameApp, { where: { id: s.gameId } });
    if (!g || !this.canPlay(g, userId).ok) throw new ForbiddenException('Bu oyuna katılamazsın (test modunda yalnız sahip/testçiler)');
    if (!s.participantIds.includes(userId)) {
      if (s.participantIds.length >= g.maxPlayers) throw new BadRequestException('Oyun dolu');
      s.participantIds = [...s.participantIds, userId];
      await this.em.save(GameSession, s);
    }
    const dto = this.sessionDto(s, g);
    this.emit(dto);
    return dto;
  }

  async leave(sessionId: string, userId: string): Promise<{ ok: true }> {
    const s = await this.em.findOne(GameSession, { where: { id: sessionId } });
    if (!s || s.status !== 'active') return { ok: true };
    s.participantIds = s.participantIds.filter((id) => id !== userId);
    if (!s.participantIds.length) {
      s.status = 'ended';
      s.endedAt = new Date();
    } else if (s.hostUserId === userId) {
      s.hostUserId = s.participantIds[0]!;
    }
    await this.em.save(GameSession, s);
    const g = await this.em.findOne(GameApp, { where: { id: s.gameId } });
    if (g) this.emit(this.sessionDto(s, g));
    return { ok: true };
  }

  /** Ses kanalından ayrılan kullanıcıyı oturumlardan düşür (gateway hook) */
  async onVoiceLeave(guildId: string, channelId: string, userId: string) {
    const rows = await this.em.find(GameSession, { where: { guildId, channelId, status: 'active' } });
    for (const s of rows) if (s.participantIds.includes(userId)) await this.leave(s.id, userId);
  }

  /** iframe için kısa ömürlü token */
  async launch(sessionId: string, userId: string): Promise<GameLaunchDto> {
    const s = await this.em.findOne(GameSession, { where: { id: sessionId } });
    if (!s || s.status !== 'active') throw new NotFoundException('Oyun oturumu bitti');
    if (!s.participantIds.includes(userId)) await this.join(sessionId, userId);
    const g = await this.em.findOne(GameApp, { where: { id: s.gameId } });
    if (!g) throw new NotFoundException('Oyun bulunamadı');
    const perm = this.canPlay(g, userId);
    if (!perm.ok) throw new ForbiddenException('Bu oyuna katılamazsın');
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
    const token = await this.jwt.signAsync(
      { typ: 'game', sub: userId, gid: g.id, sid: s.id, gld: s.guildId, ch: s.channelId, tm: perm.testMode },
      { secret: this.tokenSecret(), expiresIn: TOKEN_TTL_SEC, audience: `game:${g.id}`, issuer: 'dracord' },
    );
    const fresh = await this.em.findOneOrFail(GameSession, { where: { id: s.id } });
    return {
      token,
      expiresAt: new Date(exp * 1000).toISOString(),
      session: this.sessionDto(fresh, g),
      user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl ?? null },
    };
  }

  /** Oyun sunucusu: Authorization: Game <secret>, body { token } */
  async verify(authHeader: string | undefined, token: string): Promise<GameTokenClaims> {
    const m = /^Game\s+(\S+)$/i.exec(authHeader ?? '');
    if (!m) throw new UnauthorizedException('Authorization: Game <secret> gerekli');
    const hash = sha256(m[1]!);
    const g = await this.em.findOne(GameApp, { where: { secretHash: hash } });
    if (!g || !g.secretHash) throw new UnauthorizedException('Geçersiz oyun anahtarı');
    if (!timingSafeEqual(Buffer.from(hash), Buffer.from(g.secretHash))) throw new UnauthorizedException();
    let p: { sub: string; gid: string; sid: string; gld: string; ch: string; tm: boolean; exp: number; typ: string };
    try {
      p = await this.jwt.verifyAsync(String(token ?? ''), {
        secret: this.tokenSecret(),
        audience: `game:${g.id}`,
        issuer: 'dracord',
      });
    } catch {
      throw new UnauthorizedException('Token geçersiz veya süresi dolmuş');
    }
    if (p.typ !== 'game' || p.gid !== g.id) throw new UnauthorizedException('Token bu oyun için değil');
    const [user, s] = await Promise.all([
      this.em.findOne(User, { where: { id: p.sub } }),
      this.em.findOne(GameSession, { where: { id: p.sid } }),
    ]);
    if (!user || !s || s.status !== 'active') throw new UnauthorizedException('Oturum bitti');
    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      gameId: g.id,
      sessionId: s.id,
      guildId: s.guildId,
      channelId: s.channelId,
      participantIds: s.participantIds,
      testMode: Boolean(p.tm),
      exp: p.exp,
    };
  }

  // ── Admin ──
  async adminList(actorId: string, status?: GameAppStatus): Promise<GameAppDto[]> {
    await this.platformAdmin.assertIsPlatformAdmin(actorId);
    const rows = await this.em.find(GameApp, {
      where: status ? { status } : {},
      order: { submittedAt: 'DESC', createdAt: 'DESC' },
      take: 200,
    });
    const owners = rows.length ? await this.em.find(User, { where: { id: In([...new Set(rows.map((r) => r.ownerUserId))]) } }) : [];
    const names = new Map(owners.map((u) => [u.id, `${u.displayName} (@${u.username})`]));
    return rows.map((g) => ({ ...this.toDto(g, { ownerName: names.get(g.ownerUserId) ?? null }), reviewNote: g.reviewNote }));
  }

  async adminReview(
    actorId: string,
    gameId: string,
    action: 'approve' | 'reject' | 'suspend' | 'unsuspend',
    note?: string,
  ): Promise<GameAppDto> {
    await this.platformAdmin.assertIsPlatformAdmin(actorId);
    const g = await this.em.findOne(GameApp, { where: { id: gameId } });
    if (!g) throw new NotFoundException('Oyun bulunamadı');
    const n = note ? String(note).slice(0, 1000) : null;
    if ((action === 'reject' || action === 'suspend') && !n) throw new BadRequestException('Gerekçe yaz');
    g.status =
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'suspend' ? 'suspended' : 'draft';
    g.reviewNote = n;
    g.reviewedById = actorId;
    g.reviewedAt = new Date();
    const saved = await this.em.save(GameApp, g);
    if (action === 'suspend') {
      await this.em.update(GameSession, { gameId: g.id, status: 'active' }, { status: 'ended', endedAt: new Date() });
    }
    const label =
      action === 'approve' ? 'yayına alındı 🎉' : action === 'reject' ? 'reddedildi' : action === 'suspend' ? 'askıya alındı' : 'askıdan çıkarıldı (taslak)';
    const created = await this.notifications.createMany([
      {
        userId: g.ownerUserId,
        type: 'SYSTEM',
        title: `“${g.name}” ${label}`,
        body: n ?? (action === 'approve' ? 'Oyunun artık tüm Dracord kullanıcılarına açık.' : ''),
        link: '/settings/developer',
      },
    ]);
    this.notificationsRealtime.emitMany(created);
    return this.toDto(saved, { owner: true });
  }
}
