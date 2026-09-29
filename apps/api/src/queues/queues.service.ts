import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DRACORD_QUEUE } from './queues.constants';
import type { DracordJobPayload } from './queues.processor';

@Injectable()
export class QueuesService {
  constructor(
    @InjectQueue(DRACORD_QUEUE) private readonly queue: Queue<DracordJobPayload>,
  ) {}

  async enqueue(type: string, data?: Record<string, unknown>) {
    return this.queue.add(type, { type, data });
  }
}
