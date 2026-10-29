#!/usr/bin/env node
/**
 * Prod/staging smoke — auth gerektirmeyen uçlar + checklist hatırlatma.
 * Kullanım: node scripts/smoke-parity.mjs [API_BASE]
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(
  /\/$/,
  '',
);

async function check(path, expectOk = true) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const ok = expectOk ? res.ok : true;
    const body = await res.text();
    console.log(`${ok ? 'OK' : 'FAIL'} ${res.status} ${path} ${body.slice(0, 120)}`);
    return ok;
  } catch (e) {
    console.log(`FAIL  --- ${path} ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

const results = [];
results.push(await check('/health'));
results.push(await check('/health/ready'));
results.push(await check('/health/activity-sync'));
results.push(await check('/health/gateway'));
results.push(await check('/v1/health'));
results.push(await check('/health/funnel'));
results.push(await check('/client/versions'));

console.log('\nManuel smoke (native-parity-checklist.md):');
console.log('  login → mesaj → ses → oyun → watch → keşfet → ayarlar');
console.log(
  results.every(Boolean) ? '\nPublic health: PASS' : '\nPublic health: FAIL',
);
process.exit(results.every(Boolean) ? 0 : 1);
