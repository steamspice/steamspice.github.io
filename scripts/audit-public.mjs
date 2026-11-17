// Step 5: an SEO and markup audit of the built public pages (run `node scripts/audit-public.mjs [dist]` after a build).
// It checks what docs/seo-rulebook.md section 3 asks of every page and prints one line per problem. Exit code 1 when anything fails.
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = process.argv[2] || 'dist';
const walk = async (d) => (await Promise.all((await readdir(d, { withFileTypes: true })).map((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])))).flat();
const files = (await walk(dist)).filter((f) => f.endsWith('.html')).map((f) => relative(dist, f)).filter((f) => !f.startsWith('admin/')).sort();
const products = JSON.parse(await readFile(join(dist, 'data/products.json'), 'utf8'));
const problems = []; const titles = new Map(); const descs = new Map();
const bad = (page, msg) => problems.push(`${page}: ${msg}`);

for (const rel of files) {
  const html = await readFile(join(dist, rel), 'utf8');
  const meta = (re) => (html.match(re) || [])[1];
  const robots = meta(/<meta name="robots" content="([^"]*)"/i);
  const indexable = !/noindex/.test(robots || '');
  const title = meta(/<title>([\s\S]*?)<\/title>/i); const desc = meta(/<meta name="description" content="([^"]*)"/i);
  if (!/<html lang="en-GB"/.test(html)) bad(rel, 'html lang must be en-GB');
  if (!title) bad(rel, 'no title'); else { const t = title.replace(/&amp;/g, '&'); if (t.length < 20 || t.length > 70) bad(rel, `title is ${t.length} characters`); if (titles.has(title)) bad(rel, `title duplicates ${titles.get(title)}`); titles.set(title, rel); }
  if (!desc) bad(rel, 'no description'); else { if (indexable && (desc.length < 70 || desc.length > 170)) bad(rel, `description is ${desc.length} characters`); if (descs.has(desc)) bad(rel, `description duplicates ${descs.get(desc)}`); descs.set(desc, rel); }
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) bad(rel, 'needs exactly one h1');
  if (!/<link rel="icon"/.test(html)) bad(rel, 'no favicon link');
  if (!/<meta name="viewport"/.test(html)) bad(rel, 'no viewport');
  // pages kept out of the index (cart, receipt, drafts) need no share card
  if (indexable && !/<link rel="canonical" href="https?:\/\/[^"]+"/.test(html)) bad(rel, 'no absolute canonical');
  if (indexable) for (const p of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'og:site_name', 'og:locale']) if (!html.includes(`property="${p}"`)) bad(rel, `missing ${p}`);
  if (indexable) for (const n of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) if (!html.includes(`name="${n}"`)) bad(rel, `missing ${n}`);
  // images: alt, width and height; lazy only below the fold (the first image of a page is never lazy)
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  imgs.forEach((tag, i) => {
    if (!/\salt="/.test(tag)) bad(rel, `image without alt: ${tag.slice(0, 80)}`);
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) bad(rel, `image without width and height: ${tag.slice(0, 80)}`);
    if (i === 0 && /loading="lazy"/.test(tag)) bad(rel, 'the first image is lazy-loaded');
  });
  // internal links must reach a page or a file
  for (const m of html.matchAll(/\bhref="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const t = m[1];
    if (/^(?:[a-z]+:|\/\/)/i.test(t) || t.startsWith('mailto:') || t.startsWith('tel:')) continue;
    const base = t.replace(/^\.\//, '');
    if (base === '' || base === '.') continue;
    if (!existsSync(join(dist, base)) && !existsSync(join(dist, `${base}.html`)) && !existsSync(join(dist, base, 'index.html'))) bad(rel, `link to a missing page: ${t}`);
  }
  // structured data
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data; try { data = JSON.parse(m[1]); } catch { bad(rel, 'JSON-LD does not parse'); continue; }
    for (const d of Array.isArray(data) ? data : [data]) {
      if (d['@type'] === 'Organization') for (const k of ['name', 'url', 'logo']) if (!d[k]) bad(rel, `Organization is missing ${k}`);
      if (d['@type'] === 'Product') {
        const p = products.find((x) => x.name === d.name);
        if (!p) { bad(rel, `Product "${d.name}" is not in products.json`); continue; }
        const offer = d.offers || {};
        if (Number(offer.price) !== p.price_pence / 100) bad(rel, `Product "${d.name}": price ${offer.price} does not match ${p.price_pence / 100}`);
        if (offer.priceCurrency !== 'GBP') bad(rel, `Product "${d.name}": currency must be GBP`);
        const soldOut = p.stock_quantity === 0 && !(p.preorder_enabled);
        if (!offer.availability) bad(rel, `Product "${d.name}": no availability`);
        else if (soldOut !== /OutOfStock/.test(offer.availability)) bad(rel, `Product "${d.name}": availability ${offer.availability} does not match stock`);
      }
    }
  }
  console.log(`${indexable ? 'index  ' : 'noindex'} ${rel}  title ${title ? title.length : 0}  desc ${desc ? desc.length : 0}  images ${imgs.length}`);
}
console.log(problems.length ? `\n${problems.length} problem(s):\n${problems.join('\n')}` : '\nNo problems found.');
process.exit(problems.length ? 1 : 0);
