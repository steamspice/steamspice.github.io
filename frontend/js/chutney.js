// The free chutney pot (D-072): one with every order that has at least one pack. Its size label comes from a list she edits
// (rows of "from N packs, label"), empty by default. The database adds the real line when the order is placed; the browser shows a preview.
export const FREE_CHUTNEY_NAME = 'Free chutney pot';

// The row with the highest min_packs that is not above the number of packs. No match means no label.
export function chutneyLabel(packCount, tiers = []) {
  const rows = (Array.isArray(tiers) ? tiers : []).filter((t) => Number.isInteger(t.min_packs) && t.min_packs <= packCount).sort((a, b) => b.min_packs - a.min_packs);
  return rows.length ? String(rows[0].label || '').trim() || null : null;
}
// Lines of kind pack, summed by quantity (pre-order lines count).
export const packCount = (lines) => lines.reduce((n, l) => n + (l.kind === 'pack' ? l.qty : 0), 0);
// The included line for a cart or order, or null when there is no pack.
export function includedLine(lines, tiers) {
  const packs = packCount(lines);
  return packs > 0 ? { qty: 1, name: FREE_CHUTNEY_NAME, label: chutneyLabel(packs, tiers), included: true } : null;
}
