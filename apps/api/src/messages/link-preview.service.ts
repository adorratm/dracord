import { Injectable, Logger } from '@nestjs/common';
import type { MessageEmbed } from '@dracord/types';

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const MAX_EMBEDS = 3;
const FETCH_TIMEOUT_MS = 3500;
const MAX_BODY = 512_000;

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  extractUrls(content: string): string[] {
    const matches = content.match(URL_RE) ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of matches) {
      const cleaned = raw.replace(/[.,;:!?)]+$/, '');
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      out.push(cleaned);
      if (out.length >= MAX_EMBEDS) break;
    }
    return out;
  }

  async buildEmbeds(content: string): Promise<MessageEmbed[]> {
    const urls = this.extractUrls(content);
    if (!urls.length) return [];
    const embeds: MessageEmbed[] = [];
    for (const url of urls) {
      try {
        const embed = await this.fetchEmbed(url);
        if (embed) embeds.push(embed);
      } catch (err) {
        this.logger.debug(`Link preview failed for ${url}: ${String(err)}`);
      }
    }
    return embeds;
  }

  private async fetchEmbed(url: string): Promise<MessageEmbed | null> {
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
          'User-Agent': 'DracordBot/1.0 (+https://dracord.local)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) {
        return { url, title: parsed.hostname, siteName: parsed.hostname };
      }
      const ctype = res.headers.get('content-type') ?? '';
      if (!ctype.includes('text/html') && !ctype.includes('application/xhtml')) {
        return { url, title: parsed.hostname, siteName: parsed.hostname };
      }
      const buf = await res.arrayBuffer();
      const slice = buf.byteLength > MAX_BODY ? buf.slice(0, MAX_BODY) : buf;
      const html = new TextDecoder('utf-8').decode(slice);
      return this.parseOg(url, html, parsed.hostname);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseOg(url: string, html: string, fallbackHost: string): MessageEmbed {
    const meta = (prop: string): string | null => {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        'i',
      );
      const re2 = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["'][^>]*>`,
        'i',
      );
      const m = html.match(re) ?? html.match(re2);
      return m?.[1]?.trim() ? this.decodeEntities(m[1].trim()) : null;
    };
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const title = meta('og:title') ?? meta('twitter:title') ?? (titleTag ? this.decodeEntities(titleTag) : null);
    const description =
      meta('og:description') ?? meta('twitter:description') ?? meta('description');
    let imageUrl = meta('og:image') ?? meta('twitter:image');
    if (imageUrl) {
      try {
        imageUrl = new URL(imageUrl, url).toString();
      } catch {
        imageUrl = null;
      }
    }
    const siteName = meta('og:site_name') ?? fallbackHost;
    return {
      url,
      title: title ?? fallbackHost,
      description,
      imageUrl,
      siteName,
    };
  }

  private decodeEntities(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}
