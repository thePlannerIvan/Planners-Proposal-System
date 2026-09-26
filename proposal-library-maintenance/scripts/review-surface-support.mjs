/**
 * 入口与收件层共用的两件小事：写 surface + 交给模组起停宿主。
 *
 * **这里一行生命周期判据都没有** —— 起/停/判死活/开浏览器全在公共模组的 Node CLI
 * （`planners-review-core/scripts/review-host.mjs`），这一份只做"找到它、调它、把结果摊平"。
 */
export { contextPath, surfaceOnly, surfacePath, writeSurface } from './review-surface.mjs';

import { moduleScript } from './lib/planners-modules.mjs';
import { surfacePath, writeSurface } from './review-surface.mjs';

/**
 * 起（或复用）宿主。
 *
 * `opened` 是**事实**，不是要求：开不了浏览器**不是致命错误**（无头环境、CI、手边没有图形界面
 * 都是常态），内容与提交都不依赖那个窗口。公共模组的 `openReview` 在开不动时**抛**，
 * 而那时宿主其实已经起来了 —— 所以这里接住它，回宿主状态里的真 URL，如实报 `opened:false`。
 */
export async function openSurface(reviewDir, options = {}) {
  const host = await import(moduleScript('planners-review-core', 'scripts/review-host.mjs'));
  writeSurface(reviewDir, {});
  const surface = surfacePath(reviewDir);
  const port = options.port === undefined ? 0 : options.port;
  const wantOpen = options.open !== false;
  try {
    return await host.openReview(surface, port, wantOpen);
  } catch (error) {
    const fallback = host.hostState(surface);
    if (!fallback) throw error;                     // 宿主压根没起来：这才是致命
    return {
      ...fallback, started: true, reused: false, opened: false,
      surface, path: fallback.url, open_error: String(error.message || error),
    };
  }
}
