#!/usr/bin/env node
/**
 * Paket bütçesi: masaüstü arayüzünün ana JS parçası ve toplam ilk yükleme sınırı aşarsa hata verir.
 * Kullanım: node scripts/bundle-budget.mjs  (önce yarn workspace @dracord/desktop-ui build)
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('apps/desktop-ui/dist');
const BUDGET = {
  mainKb: Number(process.env.BUDGET_MAIN_KB ?? 2200), // ana giriş parçası (şu an ~1.6 MB)
  initialKb: Number(process.env.BUDGET_INITIAL_KB ?? 3200), // index.html'in doğrudan yüklediği JS+CSS
};

const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const size = (rel) => fs.statSync(path.join(dir, rel)).size / 1024;
const main = refs.filter((r) => /assets\/index-.*\.js$/.test(r));
const mainKb = main.reduce((s, r) => s + size(r), 0);
const initialKb = refs.reduce((s, r) => s + size(r), 0);
const fmt = (k) => `${(k / 1024).toFixed(2)} MB`;
console.log(`ana parça: ${fmt(mainKb)} (bütçe ${fmt(BUDGET.mainKb)})`);
console.log(`ilk yükleme: ${fmt(initialKb)} (bütçe ${fmt(BUDGET.initialKb)}) — ${refs.length} dosya`);
const over = [];
if (mainKb > BUDGET.mainKb) over.push('ana parça');
if (initialKb > BUDGET.initialKb) over.push('ilk yükleme');
if (over.length) {
  console.error(`::error::Paket bütçesi aşıldı: ${over.join(', ')}. Ağır görünümleri lazy() ile ayır.`);
  process.exit(1);
}
