import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { DRACORD_QUEUE, DracordJobTypes, type DracordJobType } from './queues.constants';
import type { DracordJobPayload } from './queues.processor';

const DEFAULT_OPTS: JobsOptions = {
  removeOnComplete: 100,
  removeOnFail: 200,
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
};

@Injectable()
export class QueuesService {
  constructor(
    @InjectQueue(DRACORD_QUEUE) private readonly queue: Queue<DracordJobPayload>,
  ) {}

  async enqueue(
    type: DracordJobType | string,
    data?: Record<string, unknown>,
    opts?: JobsOptions,
  ) {
    return this.queue.add(type, { type, data }, { ...DEFAULT_OPTS, ...opts });
  }

  async enqueueRemindersTick() {
    return this.enqueue(DracordJobTypes.REMINDERS_TICK, {}, { attempts: 1 });
  }

  async enqueuePushNotify(dtos: unknown[]) {
    return this.enqueue(DracordJobTypes.PUSH_NOTIFY, { dtos }, { attempts: 3 });
  }

  async enqueueWebhook(
    applicationId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    return this.enqueue(
      DracordJobTypes.WEBHOOK_DISPATCH,
      { applicationId, event, payload },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );
  }

  async enqueueSpotifyPoll() {
    return this.enqueue(DracordJobTypes.SPOTIFY_POLL, {}, { attempts: 1 });
  }

  async enqueueMediaScan(data: Record<string, unknown>) {
    return this.enqueue(DracordJobTypes.MEDIA_SCAN, data, { attempts: 2 });
  }

  async enqueueLinkPreview(data: {
    messageId: string;
    channelId: string;
    content: string;
  }) {
    return this.enqueue(DracordJobTypes.LINK_PREVIEW, data, { attempts: 2 });
  }

  async enqueueSearchReindex() {
    return this.enqueue(DracordJobTypes.SEARCH_REINDEX, {}, { attempts: 1 });
  }
}
