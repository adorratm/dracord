import { createHash } from 'crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { GuildSafetyService } from './guild-safety.service';
import { ContentHashService } from './content-hash.service';
import type { TrustSafetyCategory } from '@/database/entities/trust-safety-report.entity';

const GAMBLING_URL_RE =
  /(bahis|iddaa|bet365|casino|poker|slots?|gambling|stake\.com|roulette)/i;
const NSFW_URL_RE =
  /(porn|xxx|onlyfans|nsfw|hentai|adult[-_]?video|sex[-_]?cam)/i;
const COPYRIGHT_TITLE_RE =
  /(netflix|disney\+|disney plus|hbo|prime video|blu[- ]?tv|exxen|tod\.tv|bein|espn|dazn|sky sports|paramount\+)/i;
const DRUG_TEXT_RE =
  /\b(uyuşturucu sat|kokain|eroin|meth satışı|bonzai sat)\b/i;
const VIOLENCE_TEXT_RE =
  /\b(cinayet plan|adam öldür|kafa kes(eceğim)?)\b/i;

const FETCH_TIMEOUT_MS = 4000;
const MAX_PROBE_BYTES = 65_536;

export type MediaScanJobData = {
  reportId?: string;
  category?: string;
  guildId?: string | null;
  channelId?: string | null;
  messageId?: string | null;
  userId?: string | null;
  content?: string;
  attachmentUrls?: string[];
  windowTitle?: string;
  source?: string;
};

@Injectable()
export class ContentScanService {
  private readonly log = new Logger(ContentScanService.name);

  constructor(
    private readonly safety: GuildSafetyService,
    @Optional() private readonly hashes?: ContentHashService,
  ) {}

  async processScanJob(data: MediaScanJobData): Promise<void> {
    if (data.reportId && !data.content && !data.attachmentUrls?.length && !data.windowTitle) {
      this.log.debug(`media.scan enrich skip reportId=${data.reportId}`);
      return;
    }

    const guildId = data.guildId ?? null;
    const policy = await this.safety.getEffectivePolicy(guildId);
    if (policy.trusted) {
      this.log.debug(`media.scan skip trusted guild=${guildId}`);
      return;
    }

    const hits: Array<{
      category: TrustSafetyCategory;
      score: number;
      summary: string;
      evidence?: Record<string, unknown>;
    }> = [];

    const text = (data.content ?? '').trim();
    if (policy.scanText && text) {
      if (DRUG_TEXT_RE.test(text)) {
        hits.push({ category: 'drugs', score: 0.85, summary: 'Metin: uyuşturucu sinyali' });
      }
      if (VIOLENCE_TEXT_RE.test(text)) {
        hits.push({
          category: 'violence',
          score: 0.8,
          summary: 'Metin: şiddet / tehdit sinyali',
        });
      }
      if (GAMBLING_URL_RE.test(text)) {
        hits.push({ category: 'gambling', score: 0.75, summary: 'Metin: kumar/bahis sinyali' });
      }
      if (NSFW_URL_RE.test(text)) {
        hits.push({ category: 'sexual', score: 0.7, summary: 'Metin: NSFW URL sinyali' });
      }
    }

    if (policy.scanAttachments) {
      for (const url of data.attachmentUrls ?? []) {
        if (NSFW_URL_RE.test(url)) {
          hits.push({
            category: 'sexual',
            score: 0.7,
            summary: `Ek URL NSFW sinyali: ${url.slice(0, 120)}`,
          });
        }
        if (GAMBLING_URL_RE.test(url)) {
          hits.push({
            category: 'gambling',
            score: 0.72,
            summary: `Ek URL kumar sinyali: ${url.slice(0, 120)}`,
          });
        }
        const probe = await this.probeAttachment(url);
        if (probe) {
          if (probe.suspiciousHost) {
            hits.push({
              category: 'sexual',
              score: 0.65,
              summary: `Ek host şüpheli: ${probe.finalHost}`,
              evidence: { sha256Prefix: probe.sha256Prefix, contentType: probe.contentType },
            });
          }
          if (probe.sha256Prefix) {
            this.log.debug(
              `attachment fingerprint ${probe.sha256Prefix} type=${probe.contentType} host=${probe.finalHost}`,
            );
            const match = await this.hashes?.matchPrefix(probe.sha256Prefix);
            if (match) {
              hits.push({
                category: match.category,
                score: match.score,
                summary: `Hash DB eşleşmesi (${match.algorithm}): ${match.hashValue.slice(0, 16)}…`,
                evidence: {
                  sha256Prefix: probe.sha256Prefix,
                  contentType: probe.contentType,
                  hashId: match.id,
                  note: match.note,
                },
              });
            }
          }
        }
      }
    }

    if (policy.copyrightHeuristics && data.windowTitle) {
      if (COPYRIGHT_TITLE_RE.test(data.windowTitle)) {
        hits.push({
          category: 'copyright',
          score: 0.78,
          summary: `Ekran paylaşımı başlık: ${data.windowTitle.slice(0, 160)}`,
        });
      }
    }

    for (const hit of hits) {
      await this.safety.createReport(
        {
          category: hit.category,
          guildId,
          channelId: data.channelId,
          messageId: data.messageId,
          userId: data.userId,
          score: hit.score,
          summary: hit.summary,
          source: data.source ?? 'content-scan',
          evidence: {
            contentPreview: text.slice(0, 200) || undefined,
            attachmentUrls: data.attachmentUrls,
            windowTitle: data.windowTitle,
            ...(hit.evidence ?? {}),
          },
        },
        { enqueueScan: false },
      );
      this.log.warn(`T&S hit ${hit.category} guild=${guildId} score=${hit.score}`);
    }
  }

  /**
   * Ek URL’yi hafifçe tarar: redirect host, content-type, ilk baytların SHA-256 öneki.
   * Gerçek PhotoDNA / CSAM hash ortaklığı değildir — eşleme altyapısı için stub.
   */
  private async probeAttachment(url: string): Promise<{
    finalHost: string;
    contentType: string | null;
    sha256Prefix: string | null;
    suspiciousHost: boolean;
  } | null> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Range: `bytes=0-${MAX_PROBE_BYTES - 1}`,
          'User-Agent': 'DracordSafetyBot/1.0',
          Accept: 'image/*,video/*,*/*',
        },
      });
      const finalUrl = res.url || url;
      let finalHost = parsed.hostname;
      try {
        finalHost = new URL(finalUrl).hostname;
      } catch {
        /* keep */
      }
      const contentType = res.headers.get('content-type');
      const buf = Buffer.from(await res.arrayBuffer());
      const slice = buf.subarray(0, Math.min(buf.length, MAX_PROBE_BYTES));
      const sha256Prefix = slice.length
        ? createHash('sha256').update(slice).digest('hex').slice(0, 24)
        : null;
      return {
        finalHost,
        contentType,
        sha256Prefix,
        suspiciousHost: NSFW_URL_RE.test(finalHost) || NSFW_URL_RE.test(finalUrl),
      };
    } catch (err) {
      this.log.debug(`probe fail ${url}: ${err instanceof Error ? err.message : err}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
