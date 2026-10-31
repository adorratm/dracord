import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ContentHashService } from '@/moderation/content-hash.service';
import { GuildSafetyService } from '@/moderation/guild-safety.service';
import type { TrustSafetyCategory } from '@/database/entities/trust-safety-report.entity';
import { PlatformAuditService } from '@/platform/platform-audit.service';
import { PlatformAdminGuard } from '@/platform-admin/platform-admin.guard';
import { PlatformAdminService } from '@/platform-admin/platform-admin.service';
import { SearchIndexerService } from '@/search/search-indexer.service';
import { SearchService } from '@/search/search.service';
import { ElasticsearchService } from '@/search/elasticsearch.service';

@Controller('platform-admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(
    private readonly admin: PlatformAdminService,
    private readonly search: SearchService,
    private readonly indexer: SearchIndexerService,
    private readonly es: ElasticsearchService,
    private readonly safety: GuildSafetyService,
    private readonly hashes: ContentHashService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  @Get('guilds')
  listGuilds() {
    return this.admin.listGuilds();
  }

  @Get('search')
  platformSearch(
    @Query('q') q?: string,
    @Query('types') types?: string,
    @Query('guildId') guildId?: string,
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 30;
    return this.search.searchPlatformAdmin(q ?? '', {
      types: types
        ? types
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      guildId: guildId || undefined,
      channelId: channelId || undefined,
      limit: Number.isFinite(n) ? n : 30,
    });
  }

  @Get('users')
  listUsers(@Query('q') q?: string, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 50;
    return this.admin.listUsers(q ?? '', Number.isFinite(n) ? n : 50);
  }

  @Get('users/:userId')
  getUser(@Param('userId') userId: string) {
    return this.admin.getUser(userId);
  }

  @Patch('users/:userId')
  updateUser(
    @Param('userId') userId: string,
    @Req() req: { user: { sub: string } },
    @Body()
    body: {
      username?: string;
      displayName?: string;
      email?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      bannerUrl?: string | null;
      bannerColor?: string | null;
    },
  ) {
    return this.admin.updateUser(req.user.sub, userId, body ?? {});
  }

  @Post('users/:userId/disable')
  disableUser(
    @Param('userId') userId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.admin.disableUser(req.user.sub, userId);
  }

  @Post('users/:userId/enable')
  enableUser(@Param('userId') userId: string) {
    return this.admin.enableUser(userId);
  }

  @Post('users/:userId/revoke-sessions')
  revokeSessions(@Param('userId') userId: string) {
    return this.admin.revokeSessions(userId);
  }

  @Post('users/:userId/kick-all')
  kickAll(
    @Param('userId') userId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.admin.kickFromAllGuilds(req.user.sub, userId);
  }

  @Post('users/:userId/timeout')
  timeout(
    @Param('userId') userId: string,
    @Req() req: { user: { sub: string } },
    @Body() body: { guildId?: string; minutes?: number },
  ) {
    return this.admin.timeoutInGuild(
      req.user.sub,
      userId,
      body.guildId ?? '',
      body.minutes ?? 0,
    );
  }

  @Post('users/:userId/ban-guild')
  banGuild(
    @Param('userId') userId: string,
    @Req() req: { user: { sub: string } },
    @Body() body: { guildId?: string; reason?: string | null },
  ) {
    return this.admin.banFromGuild(
      req.user.sub,
      userId,
      body.guildId ?? '',
      body.reason,
    );
  }

  @Post('users/:userId/unban-guild')
  unbanGuild(
    @Param('userId') userId: string,
    @Body() body: { guildId?: string },
  ) {
    return this.admin.unbanFromGuild(userId, body.guildId ?? '');
  }

  @Delete('users/:userId')
  deleteUser(
    @Param('userId') userId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.admin.deleteUser(req.user.sub, userId);
  }

  @Get('guilds/:guildId')
  getGuild(@Param('guildId') guildId: string) {
    return this.admin.getGuild(guildId);
  }

  @Post('guilds/:guildId/discover-pin')
  pinDiscover(@Param('guildId') guildId: string) {
    return this.admin.pinDiscoverGuild(guildId);
  }

  @Delete('guilds/:guildId/discover-pin')
  unpinDiscover(@Param('guildId') guildId: string) {
    return this.admin.unpinDiscoverGuild(guildId);
  }

  @Get('guilds/:guildId/channels')
  listChannels(@Param('guildId') guildId: string) {
    return this.admin.listChannels(guildId);
  }

  @Get('guilds/:guildId/members')
  listMembers(@Param('guildId') guildId: string) {
    return this.admin.listMembers(guildId);
  }

  @Get('guilds/:guildId/messages')
  listMessages(
    @Param('guildId') guildId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const n = limit ? Number(limit) : 40;
    return this.admin.listRecentMessages(
      guildId,
      Number.isFinite(n) ? n : 40,
      before || null,
    );
  }

  @Get('search/health')
  searchHealth() {
    return this.es.health();
  }

  @Post('reindex')
  reindex() {
    return this.indexer.reindexAll();
  }

  @Get('guilds/:guildId/voice')
  listVoice(@Param('guildId') guildId: string) {
    return this.admin.listVoice(guildId);
  }

  @Get('guilds/:guildId/roles')
  listRoles(@Param('guildId') guildId: string) {
    return this.admin.listRoles(guildId);
  }

  @Get('trust-safety/reports')
  listTsReports(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 50;
    return this.safety.listOpenReports(Number.isFinite(n) ? n : 50);
  }

  @Post('trust-safety/reports/:id/resolve')
  resolveTsReport(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() body: { status?: 'resolved' | 'dismissed' },
  ) {
    return this.safety.resolveReport(
      id,
      req.user.sub,
      body?.status === 'dismissed' ? 'dismissed' : 'resolved',
    );
  }

  @Get('trust-safety/trusted-guilds')
  listTrustedGuilds() {
    return this.safety.listTrustedGuilds();
  }

  @Post('trust-safety/trusted-guilds')
  addTrustedGuild(
    @Req() req: { user: { sub: string } },
    @Body() body: { guildId?: string; note?: string },
  ) {
    return this.safety.addTrustedGuild(
      body.guildId ?? '',
      req.user.sub,
      body.note,
    );
  }

  @Delete('trust-safety/trusted-guilds/:guildId')
  removeTrustedGuild(@Param('guildId') guildId: string) {
    return this.safety.removeTrustedGuild(guildId);
  }

  @Get('trust-safety/guilds/:guildId/policy')
  getGuildSafetyPolicy(@Param('guildId') guildId: string) {
    return this.safety.getEffectivePolicy(guildId);
  }

  @Get('trust-safety/hashes')
  listContentHashes(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 100;
    return this.hashes.list(Number.isFinite(n) ? n : 100);
  }

  @Post('trust-safety/hashes')
  addContentHash(
    @Req() req: { user: { sub: string } },
    @Body()
    body: {
      hashValue?: string;
      algorithm?: string;
      category?: TrustSafetyCategory;
      score?: number;
      note?: string;
    },
  ) {
    return this.hashes.add({
      hashValue: body?.hashValue ?? '',
      algorithm: body?.algorithm,
      category: body?.category,
      score: body?.score,
      note: body?.note,
      createdByUserId: req.user.sub,
    });
  }

  @Post('trust-safety/hashes/:id/deactivate')
  deactivateContentHash(@Param('id') id: string) {
    return this.hashes.deactivate(id);
  }

  /** Toplu hash import (PhotoDNA ortaklığı değil — yerel DB) */
  @Post('trust-safety/hashes/import')
  importContentHashes(
    @Req() req: { user: { sub: string } },
    @Body()
    body: {
      text?: string;
      items?: unknown;
    },
  ) {
    const payload = body?.text ?? body?.items ?? body;
    return this.hashes.bulkImport(payload, req.user.sub);
  }

  @Get('platform-audit')
  listPlatformAudit(
    @Query('applicationId') applicationId?: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 50;
    return this.platformAudit.list({
      applicationId: applicationId || undefined,
      limit: Number.isFinite(n) ? n : 50,
    });
  }
}
