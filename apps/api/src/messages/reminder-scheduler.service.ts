import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { QueuesService } from '@/queues/queues.service';

@Injectable()
export class ReminderSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ReminderSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly queues: QueuesService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.queues.enqueueRemindersTick().catch((e) => {
        this.log.warn(`Reminder enqueue failed: ${e instanceof Error ? e.message : e}`);
      });
    }, 20_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
