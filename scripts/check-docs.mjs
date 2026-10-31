#!/usr/bin/env node
/**
 * Mintlify / docs bütünlük kontrolü.
 * docs/mintlify/docs.json navigation path’lerinin dosya olarak varlığını doğrular.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsJsonPath = existsSync(join(root, 'docs/docs.json'))
  ? join(root, 'docs/docs.json')
  : join(root, 'docs/mintlify/docs.json');

if (!existsSync(docsJsonPath)) {
  console.error('FAIL missing docs/docs.json');
  process.exit(1);
}

console.log(`Using ${docsJsonPath.replace(root + '\\', '').replace(root + '/', '')}`);
const cfg = JSON.parse(readFileSync(docsJsonPath, 'utf8'));
const pages = [];
for (const tab of cfg.navigation?.tabs ?? []) {
  for (const group of tab.groups ?? []) {
    for (const p of group.pages ?? []) pages.push(p);
  }
}

const openapi = cfg.api?.openapi ?? [];
let ok = true;

for (const p of pages) {
  const md = join(root, 'docs', `${p}.md`);
  const mdx = join(root, 'docs', `${p}.mdx`);
  if (!existsSync(md) && !existsSync(mdx)) {
    console.error(`FAIL missing page: docs/${p}.md(x)`);
    ok = false;
  } else {
    console.log(`OK page ${p}`);
  }
}

for (const o of openapi) {
  const path = join(root, 'docs', o);
  if (!existsSync(path)) {
    console.error(`FAIL missing openapi: docs/${o}`);
    ok = false;
  } else {
    console.log(`OK openapi ${o}`);
  }
}

const required = [
  'docs/mintlify/README.md',
  'docs/developer/scaling.md',
  'docs/developer/bot-gateway.md',
  'apps/docs/package.json',
];
for (const r of required) {
  if (!existsSync(join(root, r))) {
    console.error(`FAIL missing ${r}`);
    ok = false;
  } else {
    console.log(`OK ${r}`);
  }
}

console.log(ok ? '\nDocs check: PASS' : '\nDocs check: FAIL');
process.exit(ok ? 0 : 1);
