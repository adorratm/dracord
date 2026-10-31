#!/usr/bin/env node
/**
 * Gateway shard MVP smoke — discovery + guild hash tutarlılığı.
 *
 * Kullanım:
 *   node scripts/smoke-shard.mjs [API_BASE]
 *   SHARD_COUNT=2 node scripts/smoke-shard.mjs http://localhost:4000
 *
 * Multi-pod: her instance’ın /.well-known/dracord yanıtında shard_id farklı olmalı;
 * aynı algorithm + count ile guildShardIndex eşleşmeli.
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(
  /\/$/,
  '',
);

function guildShardIndex(guildId, shardCount) {
  const n = Math.max(1, Math.floor(shardCount) || 1);
  try {
    return Number((BigInt(String(guildId).trim()) >> 22n) % BigInt(n));
  } catch {
    let h = 0x811c9dc5;
    for (let i = 0; i < guildId.length; i++) {
      h ^= guildId.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) % n;
  }
}

const samples = [
  '123456789012345678',
  '987654321098765432',
  '1',
  'non-numeric-guild',
];

let failed = false;

async function main() {
  const res = await fetch(`${base}/.well-known/dracord`, { cache: 'no-store' });
  if (!res.ok) {
    console.error(`FAIL discovery ${res.status}`);
    process.exit(1);
  }
  const disc = await res.json();
  const shardId = Number(disc.instance?.shard_id ?? 0);
  const shardCount = Number(disc.instance?.shard_count ?? 1);
  const algo = disc.instance?.shard_algorithm;
  const feature = Boolean(disc.features?.gateway_shard);

  console.log(`OK discovery shard=${shardId}/${shardCount} algo=${algo ?? '—'} feature=${feature}`);

  if (!feature && shardCount > 1) {
    console.error('FAIL features.gateway_shard false ama COUNT>1');
    failed = true;
  }
  if (shardCount > 1 && algo !== 'discord_guild_hash_v1') {
    console.error(`FAIL expected shard_algorithm discord_guild_hash_v1 got ${algo}`);
    failed = true;
  }

  const expectCount = Number(process.env.SHARD_COUNT || shardCount);
  for (const g of samples) {
    const idx = guildShardIndex(g, expectCount);
    const mine = idx === shardId || expectCount <= 1;
    console.log(
      `${mine || expectCount <= 1 ? 'OK' : 'INFO'} guild=${g} → shard ${idx}/${expectCount} (instance=${shardId})`,
    );
  }

  const health = await fetch(`${base}/v1/health`, { cache: 'no-store' });
  console.log(`${health.ok ? 'OK' : 'FAIL'} /v1/health ${health.status}`);
  if (!health.ok) failed = true;

  // İkinci base (opsiyonel multi-pod)
  const peer = process.env.SHARD_PEER_URL?.replace(/\/$/, '');
  if (peer) {
    const r2 = await fetch(`${peer}/.well-known/dracord`, { cache: 'no-store' });
    if (!r2.ok) {
      console.error(`FAIL peer discovery ${r2.status}`);
      failed = true;
    } else {
      const d2 = await r2.json();
      const id2 = Number(d2.instance?.shard_id ?? -1);
      const c2 = Number(d2.instance?.shard_count ?? 0);
      console.log(`OK peer shard=${id2}/${c2}`);
      if (c2 !== shardCount) {
        console.error('FAIL peer shard_count mismatch');
        failed = true;
      }
      if (id2 === shardId && shardCount > 1) {
        console.error('FAIL peer aynı shard_id — multi-pod yanlış yapılandırılmış');
        failed = true;
      }
      if (d2.instance?.shard_algorithm !== algo) {
        console.error('FAIL peer algorithm mismatch');
        failed = true;
      }
    }
  } else {
    console.log('INFO SHARD_PEER_URL yok — tek instance smoke');
  }

  console.log(failed ? '\nShard smoke: FAIL' : '\nShard smoke: PASS');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
