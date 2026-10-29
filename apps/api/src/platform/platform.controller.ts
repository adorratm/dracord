import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { MessagesService } from '@/messages/messages.service';
import { BotAuthGuard, type BotAuthContext } from './bot-auth.guard';
import { isPlatformApiEnabled, isPlatformOauthEnabled } from './platform-enabled';
import { PlatformService } from './platform.service';

@Controller()
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly messages: MessagesService,
    private readonly config: ConfigService,
  ) {}

  /** Her zaman erişilebilir — flag durumu */
  @Get('v1/health')
  v1Health() {
    return {
      ok: true,
      platformApi: isPlatformApiEnabled(this.config),
      platformOauth: isPlatformOauthEnabled(this.config),
      service: 'dracord-platform',
    };
  }

  @Get('platform/applications')
  @UseGuards(JwtAuthGuard)
  listApps(@Req() req: { user: { sub: string } }) {
    return this.platform.listMine(req.user.sub);
  }

  @Post('platform/applications')
  @UseGuards(JwtAuthGuard)
  createApp(
    @Req() req: { user: { sub: string } },
    @Body()
    body: {
      name: string;
      description?: string;
      redirectUris?: string[];
      withBot?: boolean;
    },
  ) {
    return this.platform.create(req.user.sub, body ?? { name: '' });
  }

  @Post('platform/applications/:id/reset-token')
  @UseGuards(JwtAuthGuard)
  resetToken(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.platform.resetBotToken(req.user.sub, id);
  }

  @Put('platform/applications/:id/webhook')
  @UseGuards(JwtAuthGuard)
  setWebhook(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { url: string | null },
  ) {
    return this.platform.setWebhook(req.user.sub, id, body?.url ?? null);
  }

  @Delete('platform/applications/:id')
  @UseGuards(JwtAuthGuard)
  deleteApp(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.platform.deleteApp(req.user.sub, id);
  }

  @Post('v1/channels/:channelId/messages')
  @UseGuards(BotAuthGuard)
  async botPostMessage(
    @Req() req: { bot: BotAuthContext },
    @Param('channelId') channelId: string,
    @Body() body: { content?: string },
  ) {
    if (!req.bot.scopes.includes('messages.write') && !req.bot.scopes.includes('bot')) {
      return { error: 'messages.write scope gerekli' };
    }
    const content = typeof body?.content === 'string' ? body.content : '';
    const { message } = await this.messages.createMessage(
      channelId,
      req.bot.botUserId,
      content,
    );
    void this.platform.dispatchWebhook(req.bot.applicationId, 'MESSAGE_CREATE', {
      channelId,
      messageId: message.id,
    });
    return message;
  }

  @Get('v1/users/@me')
  @UseGuards(BotAuthGuard)
  botMe(@Req() req: { bot: BotAuthContext }) {
    return {
      id: req.bot.botUserId,
      applicationId: req.bot.applicationId,
      bot: true,
    };
  }

  @Get('v1/guilds/:guildId')
  @UseGuards(BotAuthGuard)
  botGuild(
    @Req() req: { bot: BotAuthContext },
    @Param('guildId') guildId: string,
  ) {
    if (
      !req.bot.scopes.includes('guilds') &&
      !req.bot.scopes.includes('bot')
    ) {
      return { error: 'guilds scope gerekli' };
    }
    return this.platform.getGuildForBot(req.bot.botUserId, guildId);
  }

  @Put('v1/applications/:applicationId/commands')
  @UseGuards(BotAuthGuard)
  syncCommands(
    @Req() req: { bot: BotAuthContext },
    @Param('applicationId') applicationId: string,
    @Body()
    body: {
      guildId?: string;
      commands?: Array<{
        name: string;
        description: string;
        usage?: string;
        aliases?: string[];
        responseTemplate?: string;
      }>;
    },
  ) {
    if (req.bot.applicationId !== applicationId) {
      return { error: 'applicationId token ile uyuşmuyor' };
    }
    if (
      !req.bot.scopes.includes('applications.commands') &&
      !req.bot.scopes.includes('bot')
    ) {
      return { error: 'applications.commands scope gerekli' };
    }
    return this.platform.syncSlashCommands(
      applicationId,
      req.bot.botUserId,
      req.bot.ownerUserId,
      { guildId: body?.guildId ?? '', commands: body?.commands },
    );
  }

  /** JSON onay — web consent widget Bearer ile çağırır */
  @Post('oauth2/authorize')
  @UseGuards(JwtAuthGuard)
  oauthAuthorizeJson(
    @Req() req: { user: { sub: string } },
    @Body()
    body: {
      client_id?: string;
      redirect_uri?: string;
      response_type?: string;
      state?: string;
    },
  ) {
    if ((body.response_type ?? 'code') !== 'code') {
      return { error: 'response_type=code gerekli' };
    }
    return this.issueOauthCode(
      req.user.sub,
      body.client_id ?? '',
      body.redirect_uri ?? '',
      body.state,
    );
  }

  /** Dracord ile giriş — authorize (redirect; Authorization header gerekir) */
  @Get('oauth2/authorize')
  @UseGuards(JwtAuthGuard)
  async oauthAuthorize(
    @Req() req: { user: { sub: string } },
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (responseType !== 'code') {
      return res.status(400).json({ error: 'response_type=code gerekli' });
    }
    try {
      const result = await this.issueOauthCode(
        req.user.sub,
        clientId,
        redirectUri,
        state,
      );
      if ('error' in result) {
        return res.status(400).json(result);
      }
      return res.redirect(result.redirect);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'authorize failed';
      return res.status(400).json({ error: msg });
    }
  }

  @Post('oauth2/token')
  oauthToken(
    @Body()
    body: {
      grant_type?: string;
      code?: string;
      client_id?: string;
      redirect_uri?: string;
    },
  ) {
    if (body.grant_type !== 'authorization_code') {
      return { error: 'unsupported_grant_type' };
    }
    return this.platform.exchangeCode({
      code: body.code ?? '',
      clientId: body.client_id ?? '',
      redirectUri: body.redirect_uri ?? '',
    });
  }

  private async issueOauthCode(
    userId: string,
    clientId: string,
    redirectUri: string,
    state?: string,
  ) {
    const app = await this.platform.findApp(clientId);
    if (!app) return { error: 'client_id geçersiz' as const };
    const allowed = (app.redirectUris ?? []).includes(redirectUri);
    if (!allowed) return { error: 'redirect_uri kayıtlı değil' as const };
    const code = this.platform.createAuthCode({
      applicationId: clientId,
      userId,
      redirectUri,
    });
    const url = new URL(redirectUri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);
    return {
      code,
      state: state ?? null,
      redirect: url.toString(),
      redirect_uri: redirectUri,
    };
  }
}
