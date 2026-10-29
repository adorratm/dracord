import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { StickersService } from './stickers.service';

@Controller('stickers')
export class StickersController {
  constructor(private readonly stickers: StickersService) {}

  @Get('marketplace')
  @UseGuards(JwtAuthGuard)
  marketplace() {
    return this.stickers.listMarketplace();
  }

  @Post('marketplace/:packId/install')
  @UseGuards(JwtAuthGuard)
  install(
    @Req() req: { user: { sub: string } },
    @Param('packId') packId: string,
  ) {
    return this.stickers.installPack(req.user.sub, packId);
  }
}
