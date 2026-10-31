import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bullmq';
import type { NotificationDto } from '@dracord/types';
import { MessagesService } from '@/messages/messages.service';
import { ContentScanService } from '@/moderation/content-scan.service';
import type { MediaScanJobData } from '@/moderation/content-scan.service';
import { PushService } from '@/notifications/push.service';
import { PlatformService } from '@/platform/platform.service';
import { SearchIndexerService } from '@/search/search-indexer.service';
import { SpotifyService } from '@/spotify/spotify.service';
import { DRACORD_QUEUE, DracordJobTypes } from './queues.constants';

export interface DracordJobPayload {
  type: string;
  data?: Record<string, unknown>;
}

@Processor(DRACORD_QUEUE)
export class QueuesProcessor extends WorkerHost {
  private readonly logger = new Logger(QueuesProcessor.name);

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async process(job: Job<DracordJobPayload>): Promise<void> {
    const type = job.data?.type ?? job.name;
    this.logger.debug(`job ${job.id} type=${type}`);

    switch (type) {
      case DracordJobTypes.REMINDERS_TICK: {
        const messages = this.moduleRef.get(MessagesService, { strict: false });
        await messages.fireDueReminders();
        return;
      }
      case DracordJobTypes.PUSH_NOTIFY: {
        const push = this.moduleRef.get(PushService, { strict: false });
        const dtos = (job.data.data?.dtos ?? []) as NotificationDto[];
        await push.deliverNotificationDtos(dtos);
        return;
      }
      case DracordJobTypes.WEBHOOK_DISPATCH: {
        const platform = this.moduleRef.get(PlatformService, { strict: false });
        const d = job.data.data ?? {};
        await platform.deliverWebhook(
          String(d.applicationId ?? ''),
          String(d.event ?? ''),
          (d.payload as Record<string, unknown>) ?? {},
        );
        return;
      }
      case DracordJobTypes.SPOTIFY_POLL: {
        const spotify = this.moduleRef.get(SpotifyService, { strict: false });
        await spotify.pollAllOnce();
        return;
      }
      case DracordJobTypes.MEDIA_SCAN: {
        const scan = this.moduleRef.get(ContentScanService, { strict: false });
        await scan.processScanJob((job.data.data ?? {}) as MediaScanJobData);
        return;
      }
      case DracordJobTypes.LINK_PREVIEW: {
        const messages = this.moduleRef.get(MessagesService, { strict: false });
        const d = job.data.data ?? {};
        await messages.applyLinkPreviewEmbeds(
          String(d.messageId ?? ''),
          String(d.channelId ?? ''),
          String(d.content ?? ''),
        );
        return;
      }
      case DracordJobTypes.SEARCH_REINDEX: {
        const indexer = this.moduleRef.get(SearchIndexerService, { strict: false });
        await indexer.reindexAll();
        return;
      }
      default:
        this.logger.warn(`Unknown job type: ${type}`);
    }
  }
}
