import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { MusicJobPayload } from '@dracord/types';
import { Queue } from 'bullmq';
import { MUSIC_QUEUE } from './music.constants';

@Injectable()
export class MusicJobsService {
  constructor(
    @InjectQueue(MUSIC_QUEUE) private readonly queue: Queue<MusicJobPayload>,
  ) {}

  async enqueue(payload: MusicJobPayload) {
    return this.queue.add(payload.type, payload, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 2,
    });
  }
}
