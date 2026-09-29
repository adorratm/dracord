import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get('gifs/status')
  status() {
    return { configured: this.media.isConfigured(), provider: 'klipy' };
  }

  @Get('gifs/search')
  search(@Query('q') q = '') {
    return this.media.searchGifs(q);
  }

  @Get('gifs/featured')
  featured() {
    return this.media.featuredGifs();
  }

  /** Eski Tenor yolları — geriye dönük uyumluluk */
  @Get('tenor/status')
  tenorStatus() {
    return this.status();
  }

  @Get('tenor/search')
  tenorSearch(@Query('q') q = '') {
    return this.search(q);
  }

  @Get('tenor/featured')
  tenorFeatured() {
    return this.featured();
  }
}
