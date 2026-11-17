// Pickup dates and times from rules and exceptions (same shape as the future database tables).
import { siteConfig } from './site-config.js';

// Slot length when a rule or exception does not say: the named step constant (D-038).
const DEFAULT_SLOT_MINUTES = siteConfig.pickupStepMinutes;
const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * MINUTES_PER_HOUR + m; };
const toHhmm = (min) => `${String(Math.floor(min / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(min % MINUTES_PER_HOUR).padStart(2, '0')}`;

// UK wall-clock parts for an instant.
export function ukParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return { y: +parts.year, m: +parts.month, d: +parts.day, hh: +parts.hour, mm: +parts.minute };
}

const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

export function dateLabel(iso) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T00:00:00Z`));
}

function slotsFor(start, end, slotMinutes) {
  const out = [];
  for (let t = toMinutes(start); t + slotMinutes <= toMinutes(end); t += slotMinutes) out.push(t);
  return out;
}

// "2 days" for a whole number of days, otherwise "36 hours".
export function noticeText(hours) {
  if (hours % 24 === 0) { const d = hours / 24; return `${d} ${d === 1 ? 'day' : 'days'}`; }
  return `${hours} hours`;
}

// Returns [{ date: '2026-11-14', label, times: [{ value: '10:00', label: '10:00 to 11:00' }] }].
// When the cart holds a customised item, `customLeadHours` replaces the usual minimum notice.
export function getPickupOptions(config, now = new Date(), { customised = false, customLeadHours, closedDates = [], notBefore = null } = {}) {
  const closed = new Set(closedDates); // days that have reached the daily order limit
  const { min_lead_hours: usualLead, max_days_ahead: maxDays } = config.settings;
  const lead = customised && Number.isFinite(customLeadHours) ? Math.max(usualLead, customLeadHours) : usualLead;
  const ukNow = ukParts(now);
  const todayMs = Date.UTC(ukNow.y, ukNow.m - 1, ukNow.d);
  const nowWallMin = todayMs / MS_PER_MINUTE + ukNow.hh * MINUTES_PER_HOUR + ukNow.mm;
  const earliestMin = nowWallMin + lead * MINUTES_PER_HOUR;
  const options = [];

  for (let offset = 0; offset <= maxDays; offset += 1) {
    const dayMs = todayMs + offset * MINUTES_PER_DAY * MS_PER_MINUTE;
    const date = isoDate(dayMs);
    const weekday = new Date(dayMs).getUTCDay();
    const slots = new Map(); // start minute -> slot length
    for (const r of config.rules.filter((x) => x.active && x.weekday === weekday)) {
      const len = r.slot_minutes || DEFAULT_SLOT_MINUTES;
      slotsFor(r.start_time, r.end_time, len).forEach((t) => slots.set(t, len));
    }
    for (const ex of config.exceptions.filter((x) => x.date === date)) {
      if (ex.kind === 'extra') {
        const len = ex.slot_minutes || DEFAULT_SLOT_MINUTES;
        slotsFor(ex.start_time, ex.end_time, len).forEach((t) => slots.set(t, len));
      } else if (!ex.end_time) {
        slots.clear();
      } else {
        const [from, to] = [toMinutes(ex.start_time), toMinutes(ex.end_time)];
        for (const t of [...slots.keys()]) if (t < to && t + slots.get(t) > from) slots.delete(t);
      }
    }
    const times = [...slots.entries()].sort((a, b) => a[0] - b[0])
      .filter(([t]) => dayMs / MS_PER_MINUTE + t >= earliestMin)
      .map(([t, len]) => ({ value: toHhmm(t), label: `${toHhmm(t)} to ${toHhmm(t + len)}`, end: toHhmm(t + len) }));
    if (notBefore && date < notBefore) continue; // a pre-order cart: only days on or after the latest ready date
    if (times.length && !closed.has(date)) options.push({ date, label: dateLabel(date), times });
  }
  return options;
}

// The first date a customised order can be collected, or null when none is offered.
export const earliestPickup = (config, now, customLeadHours) => getPickupOptions(config, now, { customised: true, customLeadHours })[0] || null;

// Hour and minute lists for one day's window (D-038). Only values inside the window and past the notice period are offered.
export const pickupHours = (day) => [...new Set(day.times.map((t) => t.value.slice(0, 2)))];
export const pickupMinutes = (day, hour) => day.times.filter((t) => t.value.slice(0, 2) === hour).map((t) => t.value.slice(3));
export const windowText = (day) => `Available ${day.times[0].value} to ${day.times[day.times.length - 1].end} on ${day.label.split(' ')[0]}`;

// "6:30 pm" from "18:30".
export const clockLabel = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
// "Earliest pickup: today from 6:30 pm", or the next open day and time, from the options the picker itself uses. Null when nothing is offered.
export function earliestLabel(options, now = new Date()) {
  const first = options[0];
  if (!first) return null;
  const p = ukParts(now);
  const todayIso = new Date(Date.UTC(p.y, p.m - 1, p.d)).toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.UTC(p.y, p.m - 1, p.d + 1)).toISOString().slice(0, 10);
  const day = first.date === todayIso ? 'today' : first.date === tomorrowIso ? 'tomorrow' : first.label;
  return `Earliest pickup: ${day} from ${clockLabel(first.times[0].value)}`;
}
// "Sat 22 Nov" for a date such as a pre-order ready date.
export const shortDateLabel = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00Z`));
