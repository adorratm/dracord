import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ContentHash } from '@/database/entities/content-hash.entity';
import type { TrustSafetyCategory } from '@/database/entities/trust-safety-report.entity';

@Injectable()
export class ContentHashService {
  constructor(private readonly em: EntityManager) {}

  async matchPrefix(sha256Prefix: string | null | undefined) {
    if (!sha256Prefix || sha256Prefix.length < 8) return null;
    const row = await this.em
      .createQueryBuilder(ContentHash, 'h')
      .where('h.active = true')
      .andWhere(
        `(h.hashValue = :p OR :p LIKE h.hashValue || '%' OR h.hashValue LIKE :p || '%')`,
        { p: sha256Prefix.toLowerCase() },
      )
      .orderBy('h.score', 'DESC')
      .getOne();
    return row;
  }

  async list(limit = 100) {
    return this.em.find(ContentHash, {
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  async add(opts: {
    hashValue: string;
    algorithm?: string;
    category?: TrustSafetyCategory;
    score?: number;
    note?: string;
    createdByUserId?: string;
  }) {
    const hashValue = opts.hashValue?.trim().toLowerCase();
    if (!hashValue || hashValue.length < 8 || hashValue.length > 128) {
      throw new BadRequestException('hashValue 8–128 karakter olmalı');
    }
    if (!/^[a-f0-9]+$/i.test(hashValue)) {
      throw new BadRequestException('hashValue hex olmalı');
    }
    const row = this.em.create(ContentHash, {
      hashValue,
      algorithm: opts.algorithm?.trim() || 'sha256-prefix',
      category: opts.category ?? 'csam',
      score:
        typeof opts.score === 'number' && Number.isFinite(opts.score)
          ? Math.min(1, Math.max(0, opts.score))
          : 0.95,
      note: opts.note?.slice(0, 500) ?? null,
      active: true,
      createdByUserId: opts.createdByUserId ?? null,
    });
    await this.em.save(ContentHash, row);
    return row;
  }

  async deactivate(id: string) {
    const row = await this.em.findOne(ContentHash, { where: { id } });
    if (!row) throw new NotFoundException('Hash kaydı yok');
    row.active = false;
    await this.em.save(ContentHash, row);
    return row;
  }

  /**
   * Toplu import — PhotoDNA/NCMEC ortaklığı değildir.
   * Desteklenen satır: hex hash veya `hash,algorithm,category,score,note`
   * / JSON dizi: [{ hashValue, algorithm?, category?, score?, note? }]
   */
  async bulkImport(
    payload: unknown,
    createdByUserId?: string,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const items = this.normalizeImportPayload(payload);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const item of items.slice(0, 5000)) {
      try {
        await this.add({ ...item, createdByUserId });
        imported += 1;
      } catch (e) {
        skipped += 1;
        if (errors.length < 20) {
          errors.push(e instanceof Error ? e.message : 'skip');
        }
      }
    }
    return { imported, skipped, errors };
  }

  private normalizeImportPayload(payload: unknown): Array<{
    hashValue: string;
    algorithm?: string;
    category?: TrustSafetyCategory;
    score?: number;
    note?: string;
  }> {
    if (typeof payload === 'string') {
      return payload
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((line) => {
          const parts = line.split(/[,\t]/).map((p) => p.trim());
          const hashValue = parts[0] ?? '';
          return {
            hashValue,
            algorithm: parts[1] || 'sha256-prefix',
            category: (parts[2] as TrustSafetyCategory) || 'csam',
            score: parts[3] ? Number(parts[3]) : undefined,
            note: parts[4],
          };
        });
    }
    if (Array.isArray(payload)) {
      return payload.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          hashValue: String(r.hashValue ?? r.hash ?? r.pdna ?? ''),
          algorithm: r.algorithm ? String(r.algorithm) : 'sha256-prefix',
          category: (r.category as TrustSafetyCategory) || 'csam',
          score: typeof r.score === 'number' ? r.score : undefined,
          note: r.note ? String(r.note) : undefined,
        };
      });
    }
    if (payload && typeof payload === 'object' && 'items' in payload) {
      return this.normalizeImportPayload(
        (payload as { items: unknown }).items,
      );
    }
    throw new BadRequestException(
      'Beklenen: satır satır metin, JSON dizi veya { items: [...] }',
    );
  }
}
