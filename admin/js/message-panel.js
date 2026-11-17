// The three ways to send a message to a customer (Step 4q, D-071): WhatsApp, a text message (SMS), or copy it. One small component used by the
// order's Message button and by the "Didn't go through?" strip shown after a status change. WhatsApp cannot tell us whether a number has an
// account, so nothing here claims to know.
import { buildLink, buildSmsLink } from '../../js/whatsapp.js';
import { el, toast } from './dom.js';

export const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || ''));

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  const area = el('textarea', { value: text, readOnly: true }); area.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
  document.body.append(area); area.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } area.remove();
  return ok;
}

// order: { customer_phone }, digits: the WhatsApp number or null, getText(): the message as it is now, onUsed: runs after Text message or Copy.
// withWhatsApp: show the WhatsApp link too (the full Message choices; on a phone the strip already opened the app).
export function messageChoices({ digits, getText, withWhatsApp = true, onUsed }) {
  const row = el('div', { className: 'btn-row message-choices' });
  if (digits && withWhatsApp) {
    const wa = el('a', { className: 'btn btn-small', target: '_blank', rel: 'noopener noreferrer' }, 'WhatsApp');
    const sync = () => { wa.href = buildLink(digits, getText()); }; wa.addEventListener('click', sync); wa.addEventListener('focus', sync); sync();
    wa.addEventListener('click', () => onUsed?.('whatsapp'));
    row.append(wa);
  }
  if (digits) {
    const sms = el('a', { className: 'btn btn-secondary btn-small' }, 'Send as text message');
    const sync = () => { sms.href = buildSmsLink(digits, getText()); }; sms.addEventListener('click', sync); sms.addEventListener('focus', sync); sync();
    sms.addEventListener('click', () => onUsed?.('sms'));
    row.append(sms);
  }
  const copy = el('button', { type: 'button', className: 'btn btn-secondary btn-small' }, 'Copy message');
  copy.addEventListener('click', async () => { const ok = await copyText(getText()); toast(ok ? 'Message copied.' : 'The message could not be copied. Select it and copy it by hand.', { seconds: 3 }); if (ok) onUsed?.('copy'); });
  row.append(copy);
  return row;
}
