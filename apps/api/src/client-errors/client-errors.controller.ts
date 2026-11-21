import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ClientErrorsService, type ClientErrorInput } from './client-errors.service';

/** Kimlik gerekmez (giriş ekranındaki hatalar da gelsin); IP başına dakikada 30 */
@Controller('client-errors')
export class ClientErrorsController {
  constructor(private readonly s: ClientErrorsService) {}

  @Post()
  @HttpCode(204)
  async report(@Req() req: { ip?: string; headers: Record<string, string | string[] | undefined> }, @Body() body: ClientErrorInput | ClientErrorInput[]) {
    const ip = String(req.headers['cf-connecting-ip'] ?? req.ip ?? 'unknown').split(',')[0]!.trim();
    await this.s.report(ip, body);
  }
}
