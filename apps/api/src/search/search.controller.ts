import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminService } from '@/auth/platform-admin.service';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ElasticsearchService } from './elasticsearch.service';
import { SearchIndexerService } from './search-indexer.service';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly indexer: SearchIndexerService,
    private readonly es: ElasticsearchService,
    private readonly platformAdmin: PlatformAdminService,
  ) {}

  @Get()
  query(
    @CurrentUser() user: JwtPayloadUser,
    @Query('q') q = '',
    @Query('types') types?: string,
    @Query('guildId') guildId?: string,
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: string,
  ) {
    const max = Number(process.env.SEARCH_MAX_RESULTS ?? 50);
    const cap = Number.isFinite(max) && max > 0 ? Math.min(max, 100) : 50;
    const parsed = limit ? Number(limit) : 20;
    const lim = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), cap) : 20;
    return this.search.search(user.sub, q, {
      types: types ? types.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      guildId,
      channelId,
      limit: lim,
    });
  }

  @Get('health')
  async health() {
    return this.es.health();
  }

  @Post('reindex')
  async reindex(@CurrentUser() user: JwtPayloadUser) {
    await this.platformAdmin.assertIsPlatformAdmin(user.sub);
    return this.indexer.reindexAll();
  }
}
