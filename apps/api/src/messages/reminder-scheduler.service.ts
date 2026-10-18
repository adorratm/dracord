import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MessagesService } from './messages.service';

@Injectable()
export class ReminderSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ReminderSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly messages: MessagesService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, 20_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.messages.fireDueReminders();
      if (n > 0) this.log.debug(`Fired ${n} reminder(s)`);
    } catch (e) {
      this.log.warn(`Reminder tick failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }
}
