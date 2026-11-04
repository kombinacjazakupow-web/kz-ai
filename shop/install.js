export const INSTALL_HIDE_KEY = 'kombi-shop-install-hide';

export function installKind({ ua, standalone, promptReady }) {
  if (standalone) return 'installed';
  const agent = String(ua || '');
  if (/iphone|ipad|ipod/i.test(agent)) return 'ios';
  if (/android/i.test(agent)) return promptReady ? 'android' : 'android-steps';
  return promptReady ? 'android' : 'other';
}
