import { videoSrc } from '#common';

export function reelItems(products) {
  return (products || []).filter((item) => item && item.active !== false && videoSrc(item.video_url));
}

export function reelOnScreen(ratio) {
  return Number(ratio) >= 0.6;
}
