#!/usr/bin/env node
/**
 * Staging flag / discovery smoke — agresif flag’ler açık mı kontrol et (bilgi).
 * Kullanım: node scripts/smoke-staging-flags.mjs [API_BASE]
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(
  /\/$/,
  '',
);

async function get(path) {
  const res = await fetch(`${base}${path}`, { cache: 'no-store' });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, json, text };
}

const paths = [
  '/health',
  '/health/ready',
  '/health/activity-sync',
  '/health/gateway',
  '/health/funnel',
  '/v1/health',
  '/.well-known/dracord',
  '/openapi.json',
];

let failed = false;
const featureReport = [];

for (const p of paths) {
  const r = await get(p);
  const mark = r.ok ? 'OK' : 'FAIL';
  if (!r.ok) failed = true;
  console.log(`${mark} ${r.status} ${p}`);
  if (p === '/.well-known/dracord' && r.json?.features) {
    const f = r.json.features;
    for (const [k, v] of Object.entries(f)) {
      featureReport.push(`  ${k}=${JSON.stringify(v)}`);
    }
    console.log('  instance:', JSON.stringify(r.json.instance ?? {}));
  }
  if (p === '/v1/health' && r.json) {
    console.log(
      `  platformApi=${r.json.platformApi} platformOauth=${r.json.platformOauth}`,
    );
  }
}

if (featureReport.length) {
  console.log('\nDiscovery features:');
  console.log(featureReport.join('\n'));
}

console.log('\nStaging önerisi (flag’ler .env):');
console.log('  ACTIVITY_CAS=true');
console.log('  ACTIVITY_BILLIARDS_AUTHORITY=true');
console.log('  PLATFORM_API=true');
console.log('  PLATFORM_OAUTH=true');
console.log('  SOCKET_REDIS_REQUIRED=true  # multi-instance');
console.log('  INSTANCE_SHARD_COUNT=1      # veya N + sticky LB');
console.log('\nManuel: bilardo sıra değişimi, watch seek, OAuth consent, slash sync');

console.log(failed ? '\nStaging smoke: FAIL' : '\nStaging smoke: PASS');
process.exit(failed ? 1 : 0);
