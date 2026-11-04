const BUYER_KEYS = ['name', 'phone', 'street', 'postcode', 'city'];

export function hasSavedBuyer(draft) {
  return BUYER_KEYS.every((key) => String(draft?.[key] || '').trim().length > 0);
}

export function buyerLine(draft) {
  return BUYER_KEYS.map((key) => String(draft?.[key] || '').trim()).filter(Boolean).join(' · ');
}
