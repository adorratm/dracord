import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { EntityManager, In } from 'typeorm';
import {
  SocketEvents,
  TOURNAMENT_AUTO_RESULT_GAMES,
  TOURNAMENT_FORMATS,
  TOURNAMENT_GAMES,
  TOURNAMENT_GAME_LABEL,
  TOURNAMENT_LIMITS,
  buildDoubleElimination,
  buildRoundRobin,
  buildSingleElimination,
  buildTables,
  tournamentAdvance,
  tournamentMatchPlayers,
  type TournamentDto,
  type TournamentFormat,
  type TournamentGame,
  type TournamentMatch,
} from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Tournament } from '@/database/entities/tournament.entity';
import { User } from '@/database/entities/user.entity';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { GuildsService } from '@/guilds/guilds.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { NotificationsService, type CreateNotificationInput } from '@/notifications/notifications.service';

type CreateInput = {
  name: string;
  description?: string | null;
  game: TournamentGame;
  format?: TournamentFormat;
  externalGameName?: string | null;
  maxPlayers?: number;
  startsAt?: string | null;
};

/** Turnuva modu (C2): tek eleme 1v1. Sonucu iki oyuncu bildirir; anlaşmazlıkta düzenleyici karar verir. */
@Injectable()
export class TournamentsService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly broadcast: SocketBroadcastService,
    private readonly notifications: NotificationsService,
    private readonly notificationsRealtime: NotificationsRealtimeService,
  ) {}

  private async canManage(t: Pick<Tournament, 'guildId' | 'creatorId'>, userId: string) {
    if (t.creatorId === userId) return true;
    return this.guilds.memberHasPermission(t.guildId, userId, GuildPermissions.MANAGE_GUILD);
  }

  private async requireManage(t: Tournament, userId: string) {
    if (!(await this.canManage(t, userId))) throw new ForbiddenException('Bunu yalnız düzenleyici yapabilir');
  }

  private async toDto(t: Tournament): Promise<TournamentDto> {
    const ids = [...new Set(t.participantIds)];
    const [users, members] = ids.length
      ? await Promise.all([
          this.em.find(User, { where: { id: In(ids) }, select: { id: true, displayName: true, username: true, avatarUrl: true } }),
          this.em.find(GuildMember, { where: { guildId: t.guildId, userId: In(ids) }, select: { userId: true, nickname: true } }),
        ])
      : [[], []];
    const nick = new Map(members.map((m) => [m.userId, m.nickname]));
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      id: t.id,
      guildId: t.guildId,
      name: t.name,
      description: t.description,
      game: t.game,
      format: t.format ?? 'single',
      externalGameName: t.externalGameName,
      status: t.status,
      maxPlayers: t.maxPlayers,
      creatorId: t.creatorId,
      participants: t.participantIds.map((id) => {
        const u = byId.get(id);
        return {
          userId: id,
          displayName: nick.get(id) || u?.displayName || u?.username || 'Ayrılmış üye',
          avatarUrl: u?.avatarUrl ?? null,
        };
      }),
      matches: t.matches,
      rounds: t.rounds,
      winnerId: t.winnerId,
      startsAt: t.startsAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      startedAt: t.startedAt?.toISOString() ?? null,
      finishedAt: t.finishedAt?.toISOString() ?? null,
    };
  }

  private async publish(t: Tournament): Promise<TournamentDto> {
    const dto = await this.toDto(t);
    this.broadcast.emitToGuild(t.guildId, SocketEvents.TOURNAMENT_UPDATE, dto);
    return dto;
  }

  private async notify(inputs: CreateNotificationInput[]) {
    if (!inputs.length) return;
    try {
      const created = await this.notifications.createMany(inputs);
      this.notificationsRealtime.emitMany(created);
    } catch {
      /* bildirim kritik değil */
    }
  }

  /** Yeni hazır olan maçların oyuncularına haber ver */
  private readyNotices(t: Tournament, before: TournamentMatch[]): CreateNotificationInput[] {
    const was = new Map(before.map((m) => [m.id, m.status]));
    const out: CreateNotificationInput[] = [];
    for (const m of t.matches) {
      const ps = tournamentMatchPlayers(m);
      if (m.status !== 'ready' || was.get(m.id) === 'ready' || ps.length < 2) continue;
      // Lig: tüm maçlar baştan hazır — her oyuncuya tek bildirim (aşağıda)
      if (t.format === 'round_robin') continue;
      for (const uid of ps) {
        out.push({
          userId: uid,
          type: 'SYSTEM',
          title: `🏆 ${t.name}: maçın hazır`,
          body: `${m.round === t.rounds ? 'Final' : `${m.round}. tur`} ${m.players ? 'masan' : 'maçın'} başlayabilir. ${this.resultHint(t)}`,
          link: `/channels/${t.guildId}?tournament=${t.id}`,
          guildId: t.guildId,
        });
      }
    }
    if (t.format === 'round_robin' && before.length === 0) {
      for (const uid of t.participantIds) {
        const n = t.matches.filter((m) => m.p1 === uid || m.p2 === uid).length;
        out.push({
          userId: uid,
          type: 'SYSTEM',
          title: `🏆 ${t.name}: lig başladı`,
          body: `${n} maçın var; istediğin sırayla oyna. ${this.resultHint(t)}`,
          link: `/channels/${t.guildId}?tournament=${t.id}`,
          guildId: t.guildId,
        });
      }
    }
    return out;
  }

  private resultHint(t: Pick<Tournament, 'game'>) {
    return TOURNAMENT_AUTO_RESULT_GAMES.includes(t.game)
      ? 'Sunucunun oyun kanalında birlikte oynayın — sonuç kendiliğinden işlenir.'
      : 'Oynayınca sonucu bildir.';
  }

  async list(guildId: string, userId: string): Promise<TournamentDto[]> {
    await this.guilds.ensureMember(guildId, userId);
    const rows = await this.em.find(Tournament, { where: { guildId }, order: { createdAt: 'DESC' }, take: 30 });
    return Promise.all(rows.map((t) => this.toDto(t)));
  }

  async get(id: string, userId: string): Promise<TournamentDto> {
    const t = await this.em.findOne(Tournament, { where: { id } });
    if (!t) throw new NotFoundException('Turnuva bulunamadı');
    await this.guilds.ensureMember(t.guildId, userId);
    return this.toDto(t);
  }

  async create(guildId: string, userId: string, input: CreateInput): Promise<TournamentDto> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, TOURNAMENT_LIMITS.nameMax);
    if (!name) throw new BadRequestException('Turnuva adı gerekli');
    if (!(TOURNAMENT_GAMES as readonly string[]).includes(input.game)) throw new BadRequestException('Geçersiz oyun');
    const format: TournamentFormat = (TOURNAMENT_FORMATS as readonly string[]).includes(String(input.format))
      ? (input.format as TournamentFormat)
      : input.game === 'okey'
        ? 'table4'
        : 'single';
    if (input.game === 'okey' && format !== 'table4') throw new BadRequestException('Okey yalnız 4\'lü masa biçiminde oynanır');
    if (format === 'table4' && input.game !== 'okey' && input.game !== 'external' && input.game !== 'bowling' && input.game !== 'words' && input.game !== 'trivia') {
      throw new BadRequestException('Bu oyun 2 kişilik; masa biçimi seçilemez');
    }
    const ext = input.game === 'external' ? String(input.externalGameName ?? '').trim().slice(0, 40) : '';
    if (input.game === 'external' && !ext) throw new BadRequestException('Harici oyunun adını yaz');
    const cap = format === 'round_robin' ? TOURNAMENT_LIMITS.roundRobinMax : TOURNAMENT_LIMITS.maxPlayers;
    const max = Math.max(TOURNAMENT_LIMITS.minPlayers, Math.min(cap, Math.floor(Number(input.maxPlayers) || Math.min(16, cap))));
    const active = await this.em.count(Tournament, { where: { guildId, status: In(['registration', 'running']) } });
    if (active >= TOURNAMENT_LIMITS.activePerGuild) {
      throw new BadRequestException(`Aynı anda en fazla ${TOURNAMENT_LIMITS.activePerGuild} aktif turnuva olabilir`);
    }
    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    const t = this.em.create(Tournament, {
      guildId,
      name,
      description: String(input.description ?? '').trim().slice(0, TOURNAMENT_LIMITS.descMax) || null,
      game: input.game,
      format,
      externalGameName: ext || null,
      status: 'registration',
      maxPlayers: max,
      creatorId: userId,
      participantIds: [],
      matches: [],
      rounds: 0,
      winnerId: null,
      startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
      startedAt: null,
      finishedAt: null,
    });
    await this.em.save(Tournament, t);
    return this.publish(t);
  }

  /** Satır kilidiyle oku-değiştir-yaz */
  private async mutate(
    id: string,
    fn: (t: Tournament) => Promise<CreateNotificationInput[] | void> | CreateNotificationInput[] | void,
  ): Promise<TournamentDto> {
    let notices: CreateNotificationInput[] = [];
    const t = await this.em.transaction(async (tx) => {
      const row = await tx.findOne(Tournament, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException('Turnuva bulunamadı');
      notices = (await fn(row)) || [];
      await tx.save(Tournament, row);
      return row;
    });
    void this.notify(notices);
    return this.publish(t);
  }

  async join(id: string, userId: string): Promise<TournamentDto> {
    return this.mutate(id, async (t) => {
      await this.guilds.ensureMember(t.guildId, userId);
      if (t.status !== 'registration') throw new BadRequestException('Kayıtlar kapandı');
      if (t.participantIds.includes(userId)) return;
      if (t.participantIds.length >= t.maxPlayers) throw new BadRequestException('Turnuva dolu');
      t.participantIds = [...t.participantIds, userId];
    });
  }

  async leave(id: string, userId: string): Promise<TournamentDto> {
    return this.mutate(id, (t) => {
      if (t.status !== 'registration') throw new BadRequestException('Turnuva başladı; düzenleyiciden çekilmeyi iste');
      t.participantIds = t.participantIds.filter((x) => x !== userId);
    });
  }

  async start(id: string, userId: string): Promise<TournamentDto> {
    return this.mutate(id, async (t) => {
      await this.requireManage(t, userId);
      if (t.status !== 'registration') throw new BadRequestException('Turnuva zaten başladı');
      // Sunucudan ayrılanları çıkar
      const still = await this.em.find(GuildMember, {
        where: { guildId: t.guildId, userId: In(t.participantIds.length ? t.participantIds : ['-']) },
        select: { userId: true },
      });
      const set = new Set(still.map((m) => m.userId));
      const players = t.participantIds.filter((x) => set.has(x));
      if (players.length < TOURNAMENT_LIMITS.minPlayers) {
        throw new BadRequestException(`Başlamak için en az ${TOURNAMENT_LIMITS.minPlayers} oyuncu gerekli`);
      }
      // Rastgele tohum (Fisher–Yates, kripto)
      for (let i = players.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [players[i], players[j]] = [players[j]!, players[i]!];
      }
      const before = t.matches;
      const fmt = t.format ?? 'single';
      const { matches, rounds } =
        fmt === 'round_robin'
          ? buildRoundRobin(players)
          : fmt === 'table4'
            ? buildTables(players)
            : fmt === 'double'
              ? buildDoubleElimination(players)
              : buildSingleElimination(players);
      t.participantIds = players;
      t.matches = matches;
      t.rounds = rounds;
      t.status = 'running';
      t.startedAt = new Date();
      return this.readyNotices(t, before);
    });
  }

  /**
   * Sonuç bildir. Oyuncu: kendi maçında kazananı bildirir; iki bildirim uyuşunca maç biter.
   * Düzenleyici: `force` ile doğrudan karar verir (anlaşmazlık / gelmeyen oyuncu).
   */
  async report(id: string, userId: string, matchId: string, winnerId: string, force = false): Promise<TournamentDto> {
    return this.mutate(id, async (t) => {
      if (t.status !== 'running') throw new BadRequestException('Turnuva aktif değil');
      const m = t.matches.find((x) => x.id === matchId);
      if (!m) throw new NotFoundException('Maç bulunamadı');
      if (m.status === 'done') throw new BadRequestException('Bu maç bitti');
      const ps = tournamentMatchPlayers(m);
      if (ps.length < 2 || m.status === 'waiting') throw new BadRequestException('Rakipler henüz belli değil');
      if (!ps.includes(winnerId)) throw new BadRequestException('Kazanan bu maçın oyuncusu olmalı');
      const isPlayer = ps.includes(userId);
      const manager = await this.canManage(t, userId);
      const matches = t.matches.map((x) => ({ ...x, reports: { ...x.reports } }));
      const mm = matches.find((x) => x.id === matchId)!;
      let decided = false;
      let disputedNow = false;
      if (force || (!isPlayer && manager)) {
        if (!manager) throw new ForbiddenException('Bunu yalnız düzenleyici yapabilir');
        decided = true;
      } else {
        if (!isPlayer) throw new ForbiddenException('Yalnız bu maçın oyuncuları sonuç bildirebilir');
        const wasDisputed = mm.status === 'disputed';
        mm.reports[userId] = winnerId;
        if (ps.length === 2) {
          const r1 = mm.reports[ps[0]!];
          const r2 = mm.reports[ps[1]!];
          if (r1 && r2) {
            if (r1 === r2) decided = true;
            else mm.status = 'disputed';
          }
          // Kaybettiğini kabul eden oyuncunun tek bildirimi yeterli
          if (!decided && winnerId !== userId) decided = true;
        } else {
          // Masa: aynı kazananı gösteren iki oyuncu yeterli; farklı bildirimler anlaşmazlık
          const votes = Object.values(mm.reports).filter((v) => ps.includes(v));
          if (votes.filter((v) => v === winnerId).length >= 2) decided = true;
          else if (new Set(votes).size > 1) mm.status = 'disputed';
        }
        disputedNow = !decided && mm.status === 'disputed' && !wasDisputed;
      }
      return this.finishMatch(t, matches, matchId, decided ? winnerId : null, disputedNow);
    });
  }

  /** Maç kararını uygula + bildirimleri hazırla (t.matches'i günceller) */
  private async finishMatch(
    t: Tournament,
    matches: TournamentMatch[],
    matchId: string,
    winnerId: string | null,
    disputed: boolean,
    source?: 'game',
  ): Promise<CreateNotificationInput[]> {
    const before = t.matches;
    const notices: CreateNotificationInput[] = [];
    const mm = matches.find((x) => x.id === matchId)!;
    if (winnerId) {
      if (source) mm.source = source;
      const champ = tournamentAdvance(t.format ?? 'single', matches, matchId, winnerId, t.participantIds);
      if (champ) {
        t.status = 'finished';
        t.winnerId = champ;
        t.finishedAt = new Date();
        const guild = await this.em.findOne(Guild, { where: { id: t.guildId }, select: { id: true, name: true } });
        for (const uid of t.participantIds) {
          notices.push({
            userId: uid,
            type: 'SYSTEM',
            title: `🏆 ${t.name} bitti`,
            body:
              uid === champ
                ? `Tebrikler, ${guild?.name ?? 'sunucu'} turnuvasını kazandın!`
                : 'Turnuva tamamlandı — şampiyonu görmek için aç.',
            link: `/channels/${t.guildId}?tournament=${t.id}`,
            guildId: t.guildId,
          });
        }
      }
    } else if (disputed) {
      notices.push({
        userId: t.creatorId,
        type: 'SYSTEM',
        title: `⚠️ ${t.name}: sonuç anlaşmazlığı`,
        body: `${mm.round}. tur maçında oyuncular farklı kazanan bildirdi. Karar ver.`,
        link: `/channels/${t.guildId}?tournament=${t.id}`,
        guildId: t.guildId,
      });
    }
    t.matches = matches;
    return [...notices, ...this.readyNotices(t, before)];
  }

  /**
   * Oyun bitti (C6): sunucudaki aktif turnuvalarda, oyuncuları tam olarak bu oturumun oyuncuları olan
   * açık maçı bul ve oyunun kazananını işle. Etkinlik ya da ses kanalında oyunu açmak yeterli.
   */
  async reportFromGame(guildId: string, kind: string, playerIds: string[], winnerId: string): Promise<void> {
    if (!(TOURNAMENT_AUTO_RESULT_GAMES as readonly string[]).includes(kind)) return;
    const want = [...new Set(playerIds)].sort().join(',');
    const rows = await this.em.find(Tournament, {
      where: { guildId, status: 'running', game: kind as TournamentGame },
      select: { id: true, matches: true },
    });
    for (const row of rows) {
      const hit = row.matches.find(
        (m) => (m.status === 'ready' || m.status === 'disputed') && [...tournamentMatchPlayers(m)].sort().join(',') === want,
      );
      if (!hit) continue;
      await this.mutate(row.id, (t) => {
        const matches = t.matches.map((x) => ({ ...x, reports: { ...x.reports } }));
        const mm = matches.find((x) => x.id === hit.id);
        if (!mm || mm.status === 'done' || mm.status === 'waiting' || t.status !== 'running') return [];
        return this.finishMatch(t, matches, mm.id, winnerId, false, 'game');
      }).catch(() => undefined);
      return; // bir oyun yalnız bir maçı kapatır
    }
  }

  async cancel(id: string, userId: string): Promise<TournamentDto> {
    return this.mutate(id, async (t) => {
      await this.requireManage(t, userId);
      if (t.status === 'finished' || t.status === 'cancelled') throw new BadRequestException('Turnuva zaten kapandı');
      t.status = 'cancelled';
      t.finishedAt = new Date();
    });
  }

  /** Düzenleyici: kayıt aşamasında oyuncu çıkar */
  async kick(id: string, userId: string, targetId: string): Promise<TournamentDto> {
    return this.mutate(id, async (t) => {
      await this.requireManage(t, userId);
      if (t.status !== 'registration') throw new BadRequestException('Başlamış turnuvada oyuncuyu hükmen eleyebilirsin (sonucu rakibe ver)');
      t.participantIds = t.participantIds.filter((x) => x !== targetId);
    });
  }

  label(t: Pick<TournamentDto, 'game' | 'externalGameName'>) {
    return t.game === 'external' ? t.externalGameName || 'Harici oyun' : TOURNAMENT_GAME_LABEL[t.game];
  }
}
