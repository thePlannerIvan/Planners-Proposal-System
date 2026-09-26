/** 入口与收件层共用的两件小事：写 surface + 交给模组起停宿主。 */
export { contextPath, surfaceOnly, surfacePath, writeSurface } from './review-surface.mjs';

import { moduleScript } from './lib/planners-modules.mjs';
import { surfacePath, writeSurface } from './review-surface.mjs';

export async function openSurface(reviewDir, options = {}) {
  const { openReview } = await import(moduleScript('planners-review-core', 'scripts/review-host.mjs'));
  writeSurface(reviewDir, { uploads: !!options.uploads });
  const state = await openReview(surfacePath(reviewDir), options.port === undefined ? 0 : options.port, options.open !== false);
  return state;
}
