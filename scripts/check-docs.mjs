#!/usr/bin/env node
/**
 * Mintlify public docs bütünlük kontrolü.
 * Kaynak: docs/mintlify — dahili docs/ dosyaları burada olmamalı.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mintRoot = join(root, 'docs/mintlify');
const docsJsonPath = join(mintRoot, 'docs.json');

let ok = true;

if (!existsSync(docsJsonPath)) {
  console.error('FAIL missing docs/mintlify/docs.json');
  process.exit(1);
}

console.log('Using docs/mintlify/docs.json');
const cfg = JSON.parse(readFileSync(docsJsonPath, 'utf8'));
const pages = [];
for (const tab of cfg.navigation?.tabs ?? []) {
  for (const group of tab.groups ?? []) {
    for (const p of group.pages ?? []) pages.push(p);
  }
}

for (const p of pages) {
  const mdx = join(mintRoot, `${p}.mdx`);
  const md = join(mintRoot, `${p}.md`);
  if (!existsSync(mdx) && !existsSync(md)) {
    console.error(`FAIL missing page: docs/mintlify/${p}.mdx`);
    ok = false;
  } else {
    console.log(`OK page ${p}`);
  }
}

const openapi = cfg.api?.openapi;
if (openapi) {
  const path = join(mintRoot, openapi);
  if (!existsSync(path)) {
    console.error(`FAIL missing openapi: docs/mintlify/${openapi}`);
    ok = false;
  } else {
    console.log(`OK openapi ${openapi}`);
  }
}

/** Mintlify klasöründe dahili sızıntı dosyası olmasın */
const banned = [
  'prod-migration',
  'prod-guvenli-rollout',
  'gelisim-yapilacaklar',
  'yayin-ve-buyume',
  'native-parity',
  'platform-api-tasarim',
  'scaling',
  'readme.md',
  'contributing.md',
];
for (const name of readdirSync(mintRoot)) {
  const lower = name.toLowerCase();
  if (banned.some((b) => lower === b || lower.includes(b))) {
    // allow openapi.json etc.; only exact sensitive names / substrings above
    if (lower === 'readme.md' || lower === 'contributing.md' || banned.some((b) => b !== 'readme.md' && b !== 'contributing.md' && lower.includes(b))) {
      console.error(`FAIL internal-looking file in mintlify root: ${name}`);
      ok = false;
    }
  }
}

console.log(ok ? '\nDocs check: PASS' : '\nDocs check: FAIL');
process.exit(ok ? 0 : 1);
