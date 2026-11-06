import { phoneOk, postcodeOk } from './common.js';

const BUYER_KEYS = ['name', 'phone', 'street', 'postcode', 'city'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hasSavedBuyer(draft) {
  return BUYER_KEYS.every((key) => String(draft?.[key] || '').trim().length > 0);
}

export function buyerLine(draft) {
  return BUYER_KEYS.map((key) => String(draft?.[key] || '').trim()).filter(Boolean).join(' · ');
}

export function storedBuyer(stored) {
  if (!stored || stored.remember !== true) return null;
  return stored;
}

export function savedBuyerOk(draft) {
  if (!hasSavedBuyer(draft)) return false;
  const name = String(draft?.name || '').trim();
  const street = String(draft?.street || '').trim();
  const city = String(draft?.city || '').trim();
  const email = String(draft?.email || '').trim();
  if (name.length < 3 || street.length < 3 || city.length < 2) return false;
  if (!phoneOk(draft?.phone) || !postcodeOk(draft?.postcode)) return false;
  if (email && !EMAIL_RE.test(email)) return false;
  return true;
}
