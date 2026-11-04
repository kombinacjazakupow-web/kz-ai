import { videoSrc } from './common.js';

export function reelItems(products) {
  return (products || []).filter((item) => item && item.active !== false && videoSrc(item.video_url));
}
