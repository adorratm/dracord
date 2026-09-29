import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { InjectQueue } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DRACORD_QUEUE } from '@/queues/queues.constants';
import type { DracordJobPayload } from '@/queues/queues.processor';
import { QueuesModule } from '@/queues/queues.module';

@Module({
  imports: [QueuesModule],
})
export class AdminModule implements NestModule {
  constructor(
    @InjectQueue(DRACORD_QUEUE) private readonly dracordQueue: Queue<DracordJobPayload>,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullMQAdapter(this.dracordQueue)],
      serverAdapter,
    });

    consumer.apply(serverAdapter.getRouter()).forRoutes('/admin/queues');
  }
}
