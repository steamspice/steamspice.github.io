// submitOrder(order) -> { orderNumber, totalPence, emailed }. The backend is chosen in site-config.js.
import { normalizeItem } from './cart.js';
import { createMock, fetchSeed, ORDER_PREFIX, RuleError } from './mock-backend.js';
import { siteConfig } from './site-config.js';
import { callFunction, restGet, rpc, settingsMap } from './supabase-rest.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function withTimeout(promise, ms) {
  let timer;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

// A rule said no (paused, sold out, day full, ...). The message is meant for the customer; the order was not saved.
export class OrderRejected extends Error {
  constructor(code, message) { super(message); this.name = 'OrderRejected'; this.code = code; }
}

// Mock (D-048): the demo backend. Orders are saved in this browser, where the admin panel can see them, and the same rules
// as the database apply: pause, stock, lead times, daily limit. Nothing is emailed.
let sharedMock;
const safeStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const demoStore = () => (sharedMock ??= createMock({ storage: safeStorage(), loadSeed: () => fetchSeed('data/') }));
const storeOf = (config) => config.mock.store || demoStore();

const mockGateway = {
  async submit(order, config) {
    await wait(config.mock.delayMs);
    try {
      const result = await storeOf(config).placeOrder({ ...order, items: order.items.map(normalizeItem) });
      if (result.dropped) return { orderNumber: `${ORDER_PREFIX}-0000-00`, totalPence: 0, emailed: false }; // honeypot: looks like success
      return { orderNumber: result.orderNumber, totalPence: result.totalPence, emailed: false };
    } catch (e) {
      if (e instanceof RuleError) throw new OrderRejected(e.code, e.message);
      throw e;
    }
  },
  async state(config) { return storeOf(config).publicState(); },
};

// Supabase: the place-order edge function does everything (rules, prices, stock, number, email). A rule that says no comes back as
// 422 with a message for the customer; anything else (network, 5xx) throws, and the cart offers the WhatsApp backup.
const supabaseGateway = {
  async submit(order, config) {
    const { name, phone, notes, pickupDate, pickupTime, website } = order; // totalPenceHint and the like are never sent
    const items = order.items.map(normalizeItem);
    const res = await callFunction('place-order', { items, name, phone, notes, pickupDate, pickupTime, website }, config);
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (res.ok && data && data.orderNumber) return { orderNumber: data.orderNumber, totalPence: data.totalPence, emailed: Boolean(data.emailed) };
    if ((res.status === 422 || res.status === 429) && data && data.message) throw new OrderRejected(data.code || 'rejected', data.message);
    throw new Error(`place-order: ${res.status}`);
  },
  async state(config) {
    const open = { customisationFeePence: 0, customisationNote: '', orderingOpen: true, closedMessage: '', fullDates: [], customMinLeadHours: config.customMinLeadHours, chutneyTiers: [] };
    try {
      const keys = 'ordering_open,ordering_closed_message,custom_min_lead_hours,included_chutney_tiers,customisation_fee_pence,customisation_note';
      const [rows, full] = await Promise.all([restGet(`settings?select=key,value&key=in.(${keys})`, config), rpc('full_pickup_dates', {}, config).catch(() => [])]);
      const s = settingsMap(rows);
      return { customisationFeePence: Number.isInteger(s.customisation_fee_pence) ? s.customisation_fee_pence : 0, customisationNote: typeof s.customisation_note === 'string' ? s.customisation_note : '', orderingOpen: s.ordering_open !== false, closedMessage: s.ordering_closed_message || '', fullDates: Array.isArray(full) ? full : [], customMinLeadHours: Number(s.custom_min_lead_hours) || config.customMinLeadHours, chutneyTiers: Array.isArray(s.included_chutney_tiers) ? s.included_chutney_tiers : [] };
    } catch { return open; } // if the settings cannot be read the cart stays usable; the function still enforces every rule
  },
};

const gateways = { mock: mockGateway, supabase: supabaseGateway };

export async function submitOrder(order, config = siteConfig) {
  const gateway = gateways[config.backend];
  if (!gateway) throw new Error(`Unknown backend: ${config.backend}`);
  return withTimeout(gateway.submit(order, config), config.gatewayTimeoutMs);
}

// What the cart needs before an order: is ordering open (and the message), and which pickup days are full.
export async function getOrderingState(config = siteConfig) {
  const gateway = gateways[config.backend];
  if (!gateway) throw new Error(`Unknown backend: ${config.backend}`);
  const state = await gateway.state(config);
  // the customisation fee and her wording are settings, never hard-coded: the carts and the shop read them from here
  config.customisationFeePence = state.customisationFeePence || 0;
  config.customisationNote = state.customisationNote || '';
  return state;
}
