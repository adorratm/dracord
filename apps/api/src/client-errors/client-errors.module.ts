import { Module, type OnModuleInit } from '@nestjs/common';
import { ClientErrorsController } from './client-errors.controller';
import { ClientErrorsService } from './client-errors.service';

@Module({
  controllers: [ClientErrorsController],
  providers: [ClientErrorsService],
  exports: [ClientErrorsService],
})
export class ClientErrorsModule implements OnModuleInit {
  constructor(private readonly s: ClientErrorsService) {}

  onModuleInit() {
    const t = setInterval(() => void this.s.prune().catch(() => undefined), 6 * 3600_000);
    t.unref?.();
  }
}
