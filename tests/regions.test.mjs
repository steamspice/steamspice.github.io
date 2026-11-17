import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fillRegion, formatPrice, merge, renderRegion } from '../scripts/lib/render.mjs';

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');
const seed = JSON.parse(await read('frontend/data/products.seed.json'));
const content = {};
for (const p of seed) {
  try { content[p.slug] = JSON.parse(await read(`frontend/content/products/${p.slug}.json`)); } catch { /* no content file */ }
}
const products = merge(seed, content);

test('formatPrice shows pounds', () => {
  assert.equal(formatPrice(1000), '£10');
  assert.equal(formatPrice(1050), '£10.50');
});

for (const [page, file] of [['index', 'index.html'], ['shop', 'shop.html']]) {
  test(`${file} fallback region matches the seed data`, async () => {
    const html = await read(`frontend/${file}`);
    assert.equal(fillRegion(html, renderRegion(page, products)), html);
  });
}

// Step 4t: the home FAQ is one text for the visible questions and the FAQPage data, and the page holds it as real HTML
import { renderFaq } from '../scripts/lib/render.mjs';
test('the FAQ renders as details elements and matching FAQPage JSON-LD, with the pickup area filled in', async () => {
  const faq = JSON.parse(await read('frontend/content/faq.json'));
  assert.equal(faq.length, 6);
  const out = renderFaq(faq, 'Leicester');
  assert.equal((out.match(/<details class="faq-item">/g) || []).length, 6);
  const ld = JSON.parse(out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'FAQPage'); assert.equal(ld.mainEntity.length, 6);
  assert.match(ld.mainEntity[5].acceptedAnswer.text, /^In Leicester\. We send the exact address on WhatsApp/);
  assert.match(out, /<span data-pickup-area>Leicester<\/span>/);
  const home = await read('frontend/index.html');
  assert.ok(home.includes(out), 'frontend/index.html carries the same FAQ as the build');
});
