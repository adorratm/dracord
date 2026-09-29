import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DRACORD_QUEUE } from './queues.constants';

export interface DracordJobPayload {
  type: string;
  data?: Record<string, unknown>;
}

@Processor(DRACORD_QUEUE)
export class QueuesProcessor extends WorkerHost {
  private readonly logger = new Logger(QueuesProcessor.name);

  async process(job: Job<DracordJobPayload>): Promise<void> {
    this.logger.log(`Processing job ${job.id} type=${job.data.type}`);
  }
}
