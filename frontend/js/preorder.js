// Pre-order rules the browser shows (D-071). The database applies the same rules again when the order is placed.
// A product is open for pre-order when its stock is 0, the switch is on and its ready date has not passed.
import { ukParts, shortDateLabel } from './pickup.js';

export const ukTodayIso = (now = new Date()) => { const p = ukParts(now); return new Date(Date.UTC(p.y, p.m - 1, p.d)).toISOString().slice(0, 10); };
export const preorderActive = (p, now = new Date()) => Boolean(p && p.preorder_enabled && p.preorder_ready_date && p.preorder_ready_date >= ukTodayIso(now) && p.stock_quantity === 0);
// "Pre-order · ready from Sat 22 Nov"
export const preorderLabel = (readyDate) => `Pre-order · ready from ${shortDateLabel(readyDate)}`;
