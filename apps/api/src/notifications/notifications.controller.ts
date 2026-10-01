import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayloadUser,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 40;
    return this.notifications.listForUser(user.sub, {
      unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
      limit: Number.isFinite(parsed) ? parsed : 40,
    });
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: JwtPayloadUser) {
    const count = await this.notifications.unreadCount(user.sub);
    return { count };
  }

  @Get('push/vapid-public-key')
  vapidPublicKey() {
    return {
      publicKey: this.push.getPublicKey(),
      enabled: this.push.isEnabled(),
    };
  }

  @Post('push/subscribe')
  subscribe(
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ) {
    return this.push.upsertSubscription(user.sub, {
      endpoint: body?.endpoint,
      keys: body?.keys,
      userAgent: body?.userAgent ?? null,
    });
  }

  @Delete('push/subscribe')
  unsubscribe(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { endpoint: string },
  ) {
    return this.push.removeSubscription(user.sub, body?.endpoint ?? '');
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.notifications.markRead(user.sub, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayloadUser) {
    return this.notifications.markAllRead(user.sub);
  }
}
