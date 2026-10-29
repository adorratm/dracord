import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { sub: string } }) {
    return this.billing.getMe(req.user.sub);
  }

  @Post('nitro/checkout')
  @UseGuards(JwtAuthGuard)
  checkout(
    @Req() req: { user: { sub: string }; ip?: string; headers: { 'x-forwarded-for'?: string } },
    @Body() body: { plan?: 'basic' | 'nitro' },
  ) {
    const plan = body?.plan === 'nitro' ? 'nitro' : 'basic';
    const fwd = req.headers['x-forwarded-for']?.split(',')[0]?.trim();
    return this.billing.checkout(req.user.sub, plan, {
      userIp: fwd || req.ip,
    });
  }

  @Post('nitro/subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(
    @Req() req: { user: { sub: string } },
    @Body() body: { plan?: 'basic' | 'nitro'; paytrToken?: string },
  ) {
    const plan = body?.plan === 'nitro' ? 'nitro' : 'basic';
    return this.billing.subscribe(req.user.sub, plan, {
      paytrToken: body?.paytrToken,
    });
  }

  @Post('nitro/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@Req() req: { user: { sub: string } }) {
    return this.billing.cancel(req.user.sub);
  }

  /** PayTR sunucu bildirimi — auth yok (imza sonraki) */
  @Post('paytr/callback')
  paytr(@Body() body: Record<string, unknown>) {
    return this.billing.paytrCallback(body ?? {});
  }
}
