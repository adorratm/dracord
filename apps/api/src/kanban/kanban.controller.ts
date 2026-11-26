import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { KanbanCardInput } from '@dracord/types';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { KanbanService } from './kanban.service';

type AuthedReq = { user: { sub: string } };

/** D5 — /channels/:channelId/kanban */
@Controller('channels/:channelId/kanban')
@UseGuards(JwtAuthGuard)
export class KanbanController {
  constructor(private readonly kanban: KanbanService) {}

  @Get()
  board(@Param('channelId') channelId: string, @Req() req: AuthedReq) {
    return this.kanban.board(channelId, req.user.sub);
  }

  @Post('cards')
  createCard(@Param('channelId') channelId: string, @Req() req: AuthedReq, @Body() body: KanbanCardInput) {
    return this.kanban.createCard(channelId, req.user.sub, body);
  }

  @Patch('cards/:cardId')
  updateCard(@Param('channelId') channelId: string, @Param('cardId') cardId: string, @Req() req: AuthedReq, @Body() body: KanbanCardInput) {
    return this.kanban.updateCard(channelId, req.user.sub, cardId, body);
  }

  @Delete('cards/:cardId')
  deleteCard(@Param('channelId') channelId: string, @Param('cardId') cardId: string, @Req() req: AuthedReq) {
    return this.kanban.deleteCard(channelId, req.user.sub, cardId);
  }

  @Post('columns')
  upsertColumn(
    @Param('channelId') channelId: string,
    @Req() req: AuthedReq,
    @Body() body: { id?: string; name?: string; color?: string | null; position?: number },
  ) {
    return this.kanban.upsertColumn(channelId, req.user.sub, body);
  }

  @Delete('columns/:columnId')
  deleteColumn(@Param('channelId') channelId: string, @Param('columnId') columnId: string, @Req() req: AuthedReq) {
    return this.kanban.deleteColumn(channelId, req.user.sub, columnId);
  }
}
