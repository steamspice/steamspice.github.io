// Pure functions that render the marked product regions and JSON-LD. Used by build.mjs and the tests.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

import { formatPrice } from '../../frontend/js/cart.js';
import { HOME_PRODUCT_LIMIT, KIND_LABELS, LOW_STOCK_THRESHOLD, SEARCH_MIN_PRODUCTS, siteConfig } from '../../frontend/js/site-config.js';

export { formatPrice };
// D-052: a value the owner has not confirmed shows as a normal value; an invisible data-pending attribute marks it for the launch gate.
const priceHtml = (p) => (p.pending ? `<span data-pending>${formatPrice(p.price_pence)}</span>` : formatPrice(p.price_pence));

const byOrder = (a, b) => a.sort_order - b.sort_order;
export const merge = (products, content) =>
  products.map((p) => ({ ...p, ...(content[p.slug] || {}) })).sort(byOrder);

function productJsonLd(products, siteUrl) {
  const base = siteUrl ? `${siteUrl}/` : '';
  const items = products.filter((p) => p.price_pence != null && !p.pending).map((p) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: [p.description || p.summary || `${p.name}, ${p.unit_label}`, ingredientsOf(p).length && `Ingredients: ${ingredientsOf(p).map((i) => i.name).join(', ')}.`, (p.allergens || []).length && `Contains: ${p.allergens.join(', ')}.`, p.allergen_note].filter(Boolean).join(' '),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'GBP',
      price: (p.price_pence / 100).toFixed(2),
      availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${base}shop`,
    },
  }));
  return items.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n');
}

const PACK_ALT = 'A bag of frozen momo tied with twine and a blank paper tag';
const MEDIA_SIZES = '(min-width: 40em) 16rem, 28vw'; // the card picture is about 16rem wide on a wide screen and about a quarter of the screen on a phone
const kindLabel = (kind) => KIND_LABELS[kind] || kind.charAt(0).toUpperCase() + kind.slice(1);

// Image tile: the product photo, or a quiet drawn placeholder until a photo exists.
function mediaHtml(p, sizes = MEDIA_SIZES, cls = '') {
  if (p.photo) {
    const base = p.photo.includes('/') ? `assets/${esc(p.photo)}` : `assets/img/${esc(p.photo)}`; // 'products/<slug>' = built from an uploaded photo
    const multiply = p.photo.startsWith('pack-'); // opaque shots on white: blended into the tinted tile
    return `<div class="card-media${cls}${multiply ? ' card-media-multiply' : ''}"><img src="${base}.webp" srcset="${base}-400.webp 400w, ${base}.webp 800w" sizes="${sizes}" width="800" height="800" alt="${multiply ? PACK_ALT : esc(p.photo_alt || p.name)}" loading="lazy"></div>`;
  }
  const art = p.kind === 'addon' ? 'bowl' : 'momo';
  return `<div class="card-media${cls} card-art card-art-${art}" aria-hidden="true"></div>`;
}

function priceBlock(p) {
  if (p.price_pence == null) return '';
  return `<p class="card-price">${priceHtml(p)}</p>`;
}

const groupsOf = (p) => (p.option_groups || []).filter((g) => (g.options || []).length);
const hasOptions = (p) => groupsOf(p).length > 0;
// Pre-order (D-071): stock 0, the switch on, and a ready date that has not passed. The date is also checked again in the browser.
// Ingredients are { id, name, removable }; older data may be plain names (always included).
export const ingredientsOf = (p) => (p.ingredients || []).map((i) => (typeof i === 'string' ? { id: i.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: i, removable: false } : i));
const todayIso = () => new Date().toISOString().slice(0, 10);
const preorderReady = (p) => (p.preorder_enabled && p.preorder_ready_date && p.preorder_ready_date >= todayIso() ? p.preorder_ready_date : null);
const preorderOf = (p) => (preorderReady(p) && Number.isInteger(p.stock_quantity) && p.stock_quantity === 0 ? preorderReady(p) : null);
const shortDay = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00Z`));
const preorderText = (iso) => `Pre-order · ready from ${shortDay(iso)}`;
const isSoldOut = (p) => Number.isInteger(p.stock_quantity) && p.stock_quantity === 0;
const delta = () => ''; // option prices are retired (D-073): one flat customisation fee instead

function optionGroupHtml(p, g) {
  const single = g.kind === 'single';
  const inputs = g.options.map((o) => `<label class="opt"><input type="${single ? 'radio' : 'checkbox'}" name="opt-${esc(p.slug)}-${esc(g.id)}" value="${esc(o.id)}" data-delta="0" data-default="${o.is_default ? 'true' : 'false'}"${o.is_default ? ' checked' : ''}> <span>${esc(o.label)}</span>${delta(o)}</label>`).join('\n      ');
  return `<fieldset class="opt-group" data-group="${esc(g.id)}" data-kind="${esc(g.kind)}">
      <legend>${esc(g.label)}</legend>
      <div class="opt-list">
      ${inputs}
      </div>
    </fieldset>`;
}

// The details window: one native dialog per product, with its text in the page source.
// Three zones: header (thumbnail, name, price, close), scrolling middle, footer (notes, stepper, add).
// Ingredients and allergens come from the admin's data (D-062): a clean list in her order, and the allergen names she ticked.
// With none of them the whole block is left out (D-052): nothing is invented.
// A pill per ingredient (D-073): always-included ones are greyed with a lock and cannot be left out; the others are toggles.
const LOCK = '<svg class="pill-lock" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';
const pillHtml = (i) => (i.removable
  ? `<button type="button" class="pill pill-toggle" data-ingredient="${esc(i.id)}" aria-pressed="false">${esc(i.name)}<span class="visually-hidden" data-pill-state> (included, tap to leave out)</span></button>`
  : `<button type="button" class="pill pill-fixed" data-fixed aria-disabled="true">${esc(i.name)}${LOCK}<span class="visually-hidden"> (part of the recipe, cannot be left out)</span></button>`);
export function ingredientsHtml(p) {
  const ingredients = ingredientsOf(p);
  const allergens = p.allergens || [];
  if (!ingredients.length && !allergens.length && !p.allergen_note) return '';
  return `<section class="dialog-section">
        <h3>What's in it</h3>
        ${ingredients.length ? `<div class="pills" role="group" aria-label="What is in it">${ingredients.map(pillHtml).join('')}</div>
        <p class="pill-note" data-pill-note role="status" hidden></p>` : ''}
        ${allergens.length ? `<p class="allergy-line"><strong>Contains:</strong> ${allergens.map((a) => esc(a)).join(', ')}</p>` : ''}
        ${p.allergen_note ? `<p class="allergy-line">${esc(p.allergen_note)}</p>` : ''}
      </section>`;
}

function dialogHtml(p) {
  const priced = p.price_pence != null;
  const stock = Number.isInteger(p.stock_quantity) ? p.stock_quantity : null;
  const soldOut = isSoldOut(p);
  const lowStock = stock !== null && stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  const pre = preorderOf(p);
  const stockText = pre ? preorderText(pre) : soldOut ? 'Sold out' : lowStock ? `Only ${stock} left` : '';
  const stockLine = `<p class="stock-line" data-stock-line${stockText ? '' : ' hidden'}>${stockText ? (p.stock_pending ? `<span data-pending>${stockText}</span>` : stockText) : ''}</p>`;
  const buy = priced && p.available && (!soldOut || pre)
    ? `<div class="dialog-buy">
        <div class="stepper" role="group" aria-label="Quantity of ${esc(p.name)}">
          <button type="button" class="qty-btn" data-qty-minus aria-label="Decrease quantity of ${esc(p.name)}">&minus;</button>
          <output class="stepper-count" data-qty-value>1</output>
          <button type="button" class="qty-btn" data-qty-plus aria-label="Increase quantity of ${esc(p.name)}">+</button>
        </div>
        <button type="button" class="btn" data-dialog-add><span data-dialog-add-label>${pre ? 'Pre-order' : 'Add to cart'}</span><span data-dialog-total> · ${formatPrice(p.price_pence)}</span></button>
      </div>`
    : (soldOut && !pre ? '' : '<p class="stock-line">Not available yet</p>');
  return `<dialog class="product-dialog" aria-labelledby="dlg-${esc(p.slug)}-title" data-dialog>
  <div class="dialog-panel" tabindex="-1" autofocus>
    <span class="dialog-handle" aria-hidden="true" data-dialog-handle></span>
    <div class="dialog-head" data-dialog-head>
      ${mediaHtml(p, '6rem', ' dialog-media')}
      <div class="dialog-title">
        <h2 id="dlg-${esc(p.slug)}-title">${esc(p.name)}</h2>
        <p class="card-meta">${esc(p.unit_label)}</p>
        ${priceBlock(p)}
        ${freeChutneyLine(p)}
      </div>
      <button type="button" class="dialog-close" data-dialog-close aria-label="Close"><svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg></button>
    </div>
    <div class="dialog-body" data-options>
      ${ingredientsHtml(p)}
      ${groupsOf(p).map((g) => optionGroupHtml(p, g)).join('\n      ')}
    </div>
    <div class="dialog-foot">
      <p class="custom-note" data-custom-note hidden></p>
      <p class="custom-fee" data-custom-fee hidden></p>
      ${stockLine}
      ${buy}
    </div>
  </div>
</dialog>`;
}

// Every pack comes with one free chutney pot (D-072). Nothing about its size is claimed here.
const freeChutneyLine = (p) => (p.kind === 'pack' ? '<p class="free-line">Comes with a free chutney pot</p>' : '');

function card(p) {
  const priced = p.price_pence != null;
  const stock = Number.isInteger(p.stock_quantity) ? p.stock_quantity : null;
  const soldOut = isSoldOut(p);
  const pre = preorderOf(p);
  const buyable = p.available && priced && (!soldOut || Boolean(pre));
  const preAttrs = preorderReady(p) ? ` data-preorder-ready="${esc(preorderReady(p))}"${p.preorder_limit ? ` data-preorder-limit="${p.preorder_limit}"` : ''}` : '';
  const attrs = `id="product-${esc(p.slug)}" data-slug="${esc(p.slug)}"${priced ? ` data-price-pence="${p.price_pence}"` : ''} data-kind="${esc(p.kind)}" data-name="${esc(p.name.toLowerCase())}" data-has-options="${hasOptions(p)}"${stock !== null ? ` data-stock="${stock}"` : ''}${stock !== null && p.stock_pending ? ' data-stock-pending' : ''}${preAttrs}`;
  const action = buyable
    ? `<div class="card-action" data-card-action>
      ${preorderReady(p) ? `<p class="preorder-line" data-preorder-line${pre ? '' : ' hidden'}>${pre ? esc(preorderText(pre)) : ''}</p>` : ''}
      <button type="button" class="btn btn-add" data-add-to-cart>${pre ? 'Pre-order' : 'Add to cart'}<span class="visually-hidden">: ${esc(p.name)}</span></button>
      <p class="added-note" role="status" data-added-note></p>
    </div>`
    : `<div class="card-action"><p class="badge badge-unavailable">${soldOut ? 'Sold out' : 'Not available yet'}</p></div>`;
  return `<li class="product-card" ${attrs}>
  ${mediaHtml(p)}
  <div class="card-body">
    <h3><a class="card-link" href="shop#product-${esc(p.slug)}" data-card-open>${esc(p.name)}</a></h3>
    <p class="card-meta">${esc(p.unit_label)}${p.available ? '' : ' <span class="badge badge-unavailable">Unavailable</span>'}</p>
    ${priceBlock(p)}
    ${freeChutneyLine(p)}
    ${action}
  </div>
  ${dialogHtml(p)}
</li>`;
}

function toolsHtml(products) {
  const kinds = [...new Set(products.map((p) => p.kind))];
  const chips = kinds.length >= 2;
  const search = products.length >= SEARCH_MIN_PRODUCTS;
  if (!chips && !search) return '';
  const chipHtml = chips
    ? `<div class="chips" role="group" aria-label="Filter by type">
<button type="button" class="chip" data-filter="all" aria-pressed="true">All</button>
${kinds.map((k) => `<button type="button" class="chip" data-filter="${esc(k)}" aria-pressed="false">${esc(kindLabel(k))}</button>`).join('\n')}
</div>` : '';
  const searchHtml = search
    ? `<div class="search-box"><label class="visually-hidden" for="shop-search">Search products</label><input id="shop-search" type="search" placeholder="Search products" autocomplete="off" data-shop-search></div>` : '';
  return `<div class="shop-tools" data-shop-tools>
${chipHtml}
${searchHtml}
</div>
`;
}

const EMPTY = '<p class="empty-note">New items are coming soon.</p>';

export function renderRegion(page, products, siteUrl = '') {
  if (page === 'index') {
    const shown = products.filter((p) => p.available).slice(0, HOME_PRODUCT_LIMIT);
    if (!shown.length) return EMPTY;
    // the two packs are the main row; an add-on (the chutney pot) is a slim band under them
    const packs = shown.filter((p) => p.kind !== 'addon'); const extras = shown.filter((p) => p.kind === 'addon');
    return `<div class="product-wrap product-wrap-home">
<ul class="product-grid product-grid-packs">
${packs.map(card).join('\n')}
</ul>
${extras.length ? `<ul class="product-grid product-grid-band">\n${extras.map(card).join('\n')}\n</ul>\n` : ''}</div>`;
  }
  if (!products.length) return EMPTY;
  return `<div class="product-wrap">
${toolsHtml(products)}<h2 class="visually-hidden">Our products</h2>
<ul class="product-grid" data-product-grid>
${products.map(card).join('\n')}
</ul>
<p class="empty-note" data-no-results hidden>No products match. Try another word or filter.</p>
</div>
${productJsonLd(products, siteUrl)}`;
}

// The questions on the home page (D-074): one text, used for the visible <details> and for the FAQPage structured data.
// {area} is the pickup area setting (default Leicester); the build replaces the marked span with the current value.
const faqText = (s, area) => s.replace('{area}', area);
export function renderFaq(items, area = 'Leicester') {
  const html = items.map((i) => `<details class="faq-item"><summary>${esc(i.q)}</summary><p>${esc(faqText(i.a, '\u0000')).replace('\u0000', `<span data-pickup-area>${esc(area)}</span>`)}</p></details>`).join('\n');
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: faqText(i.a, area) } })) };
  return `<div class="faq-list">\n${html}\n</div>\n<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
}
export const FAQ_RE = /(<!-- build:faq -->)[\s\S]*?(<!-- \/build:faq -->)/;

export const REGION_RE = /(<!-- build:products -->)[\s\S]*?(<!-- \/build:products -->)/;
export const fillRegion = (html, inner) => html.replace(REGION_RE, (_, a, b) => `${a}\n${inner}\n${b}`);
