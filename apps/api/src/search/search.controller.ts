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
    const parsed = limit ? Number(limit) : 20;
    return this.search.search(user.sub, q, {
      types: types ? types.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      guildId,
      channelId,
      limit: Number.isFinite(parsed) ? parsed : 20,
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
