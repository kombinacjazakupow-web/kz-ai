export const LOS_HOME_KEY = 'kombi-shop-los';

export function openHomeSurprise(seen, holding) {
  if (holding) return { show: true, mark: true, hold: true };
  if (seen === '1') return { show: false, mark: true, hold: false };
  return { show: true, mark: true, hold: true };
}
