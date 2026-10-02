import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GuildsService } from './guilds.service';

/** Eksik @everyone üye linklerini başlangıçta doldurur. */
@Injectable()
export class EveryoneRoleBootstrapService implements OnModuleInit {
  private readonly log = new Logger(EveryoneRoleBootstrapService.name);

  constructor(private readonly guilds: GuildsService) {}

  async onModuleInit() {
    try {
      const added = await this.guilds.backfillEveryoneRoles();
      if (added > 0) {
        this.log.log(`@everyone backfill: ${added} üye rolü eklendi`);
      }
    } catch (err) {
      this.log.warn(
        `@everyone backfill atlandı: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
