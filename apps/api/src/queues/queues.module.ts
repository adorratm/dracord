import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DRACORD_QUEUE } from './queues.constants';
import { QueuesProcessor } from './queues.processor';
import { QueuesService } from './queues.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        },
      }),
    }),
    BullModule.registerQueue({ name: DRACORD_QUEUE }),
  ],
  providers: [QueuesProcessor, QueuesService],
  exports: [BullModule, QueuesService],
})
export class QueuesModule {}
