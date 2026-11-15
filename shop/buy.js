export function buyLabel(priceText, soldOut) {
  if (soldOut) return 'WYPRZEDANE';
  return `Dodaj do koszyka · ${priceText}`;
}
