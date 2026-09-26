/**
 * 宿主生命周期只有一份：公共模组的 Node CLI。
 * 测试只 import 它来收干净，**不重写**任何判据（起停/判死活都归模组）。
 */
import { moduleScript } from '../../proposal-co-creation/scripts/lib/planners-modules.mjs';

const host = await import(moduleScript('planners-review-core', 'scripts/review-host.mjs'));
export const { hostAlive, hostState, stopHost, openReview } = host;
