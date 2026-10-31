/**
 * Discord-parity guild → shard hash (MVP).
 * `(guildId >> 22) % shardCount`
 *
 * INSTANCE_SHARD_ID / INSTANCE_SHARD_COUNT ile bu süreç hangi dilimi taşır.
 * Bot identify: `shard: [id, count]` — dispatch guildId’ye göre filtrelenir.
 */

export type ShardPair = [shardId: number, shardCount: number];

export function readInstanceShard(env: {
  get: (key: string) => string | undefined;
}): { shardId: number; shardCount: number } {
  const shardId = Number(env.get('INSTANCE_SHARD_ID') ?? 0);
  const shardCount = Math.max(1, Number(env.get('INSTANCE_SHARD_COUNT') ?? 1));
  return {
    shardId: Number.isFinite(shardId) ? Math.max(0, Math.floor(shardId)) : 0,
    shardCount: Number.isFinite(shardCount) ? shardCount : 1,
  };
}

/** Snowflake / sayısal guild id → shard indeksi */
export function guildShardIndex(
  guildId: string | null | undefined,
  shardCount: number,
): number {
  const n = Math.max(1, Math.floor(shardCount) || 1);
  if (!guildId) return 0;
  try {
    const id = BigInt(String(guildId).trim());
    return Number((id >> 22n) % BigInt(n));
  } catch {
    // Non-numeric id: FNV-1a 32-bit fallback
    let h = 0x811c9dc5;
    const s = String(guildId);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) % n;
  }
}

export function guildBelongsToShard(
  guildId: string | null | undefined,
  shardId: number,
  shardCount: number,
): boolean {
  if (shardCount <= 1) return true;
  return guildShardIndex(guildId, shardCount) === shardId;
}

export function parseIdentifyShard(
  raw: unknown,
  fallbackCount: number,
): ShardPair | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const id = Number(raw[0]);
  const count = Number(raw[1]);
  if (!Number.isFinite(id) || !Number.isFinite(count) || count < 1) return null;
  const c = Math.max(1, Math.floor(count));
  const i = Math.max(0, Math.floor(id));
  if (i >= c) return null;
  // Client shard count, instance count ile uyumlu olmalı (MVP: aynı olmalı)
  if (fallbackCount > 1 && c !== fallbackCount) return null;
  return [i, c];
}
