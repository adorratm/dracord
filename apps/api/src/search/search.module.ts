import { Module } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch.service';
import { SearchController } from './search.controller';
import { SearchIndexerService } from './search-indexer.service';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [ElasticsearchService, SearchIndexerService, SearchService],
  exports: [ElasticsearchService, SearchIndexerService, SearchService],
})
export class SearchModule {}
