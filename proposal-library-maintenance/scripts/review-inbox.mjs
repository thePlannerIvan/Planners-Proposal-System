#!/usr/bin/env node
/**
 * 收件：把审阅面提交的那**一份**文件翻译回本流程的原生记录 `review-feedback.json`。
 *
 * 为什么需要这一层：改前那个页面直连的自建端点做两件事 —— ①按固定规则收下 ②原样落盘。
 * 上缝之后页面只把提交交给宿主落盘（`review-submissions.json`），所以这两件事全搬到这里；
 * **原生形状一个字段不改**（原生契约里没有的字段一律摘出来进收据，不进原生记录）。
 *
 * 顺序是**被钉住的**：`validate-review-feedback.mjs`（门）必须在收件**之后**跑 ——
 * 它读的就是本层写出来的 `review-feedback.json`，收件之前它看不到这一轮。收据里写明这件事。
 *
 * 两种合法的提交（R10：整体意见不是"逐单位"的附属品）：
 *   ① **逐项处置**：`decisions` 非空 → 写原生记录（形状由 `contracts/review-feedback.schema.json` 判）。
 *   ② **只提交整体意见**：`decisions` 为空、`overall_note_zh` 非空 → **不写原生记录**
 *      （原生契约要求 `decisions` 至少一条，这是产出方自己的语义，不许悄悄补一条假决定）。
 *      整体意见进收据，原文同时留在 `review-submissions.json` 里 —— **人的那句话不许只存在于屏幕上**。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { FEEDBACK_REL, SUBMISSIONS_REL, feedbackPath, resolveSurfacePaths } from './review-surface.mjs';
import { validateAgainstSchema } from './lib/contract-validation.mjs';

const NATIVE_SCHEMA = resolve(import.meta.dirname, '../contracts/review-feedback.schema.json');
/** 原生记录里**没有**的字段：进收据，不进原生记录。 */
const LIFTED = ['pre_check', 'pre_check_note', 'overall_note_zh'];

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

export function importSubmission(surfaceFile) {
  const paths = resolveSurfacePaths(surfaceFile);
  // 审阅目录是**表面文件所在的那一层**，不是 `dir`。两者在 C4 那面恰好重合（`dir: '.'`），
  // 但 B4 的 `dir` 是 `..`（被 serve 的树含审阅包）—— 按 `dir` 解析会把原生记录写到上一层去。
  const reviewDir = dirname(paths.surface);
  const schema = JSON.parse(readFileSync(NATIVE_SCHEMA, 'utf8'));
  const receipt = {
    ok: true, surface: paths.surface, review_dir: reviewDir,
    submissions: paths.submissions, feedback: feedbackPath(reviewDir),
    imported: null, rejected: [],
  };
  if (!paths.submissions || !existsSync(paths.submissions)) {
    receipt.skipped = `还没有提交：${String(paths.submissions)}`;
    receipt.next_action_zh = '作者还没在审阅页上保存（或宿主还没落盘）。';
    return receipt;
  }
  let submission;
  try { submission = readJson(paths.submissions); }
  catch (error) { receipt.ok = false; receipt.rejected.push(`提交文件不是合法 JSON：${error.message}`); return receipt; }
  if (!submission || typeof submission !== 'object' || Array.isArray(submission)) {
    receipt.ok = false; receipt.rejected.push('提交不是对象');
    return receipt;
  }

  // R5b：页面知道、机器看不见的前提 —— 进收据（**它也确实是"拿到这份数据的人"要怎么读它的依据**）。
  for (const key of LIFTED) {
    if (Object.hasOwn(submission, key) && submission[key] !== undefined) receipt[key] = submission[key];
  }
  const declared = new Set(Object.keys(schema.properties || {}));
  const lifted = Object.keys(submission).filter((key) => !declared.has(key));
  const unknown = lifted.filter((key) => !LIFTED.includes(key));
  if (unknown.length) receipt.warnings = [`提交里有原生契约不认识的字段，已摘出来（没写进原生记录）：${unknown.join(', ')}`];

  const decisions = Array.isArray(submission.decisions) ? submission.decisions : null;
  const overallNote = typeof submission.overall_note_zh === 'string' ? submission.overall_note_zh.trim() : '';

  // ② 只提交整体意见：不写原生记录。原生契约要求 decisions 至少一条 —— 那是产出方的语义，
  //    宁可**不写**，也不替人补一条假决定（R7：人的决定只能由人给出）。
  if ((!decisions || decisions.length === 0) && overallNote) {
    receipt.imported = {
      native_written: false,
      overall_only: true,
      overall_note_zh: overallNote,
      dropped_submission_fields: lifted,
    };
    receipt.units = { count: 0, label: '方法' };
    receipt.next_action_zh = '这一份**没有**逐项处置：整体意见已经在收据里、原文留在 '
      + `${SUBMISSIONS_REL}。**不要**跑 validate-review-feedback.mjs（没有原生记录可读，它一定失败）；`
      + '先把整体意见带回对话，再决定是重出方法库还是重开审阅页。';
    return receipt;
  }
  if (!decisions || decisions.length === 0) {
    receipt.ok = false;
    receipt.rejected.push('decisions 必须是非空数组（或者只给一句 overall_note_zh）');
    return receipt;
  }

  // ① 逐项处置：**形状判据只有一份** —— `contracts/review-feedback.schema.json`（门读的也是它）。
  const native = {};
  for (const key of Object.keys(submission)) if (declared.has(key)) native[key] = submission[key];
  const errors = [];
  validateAgainstSchema(native, schema, schema, '$', errors);
  if (errors.length) {
    receipt.ok = false;
    receipt.rejected.push(...errors);
    receipt.next_action_zh = '这份提交没被收下（形状不合本面的原生契约）—— 上面每条都说明哪里不对。';
    return receipt;
  }

  const target = feedbackPath(reviewDir);
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target)) receipt.previous_latest = 'review-feedback.json 已被这一轮覆盖（本面原生只有"最新一轮"这一份）';
  writeFileSync(target, `${JSON.stringify(native, null, 2)}\n`, 'utf8');
  receipt.units = { count: native.decisions.length, label: '方法' };
  receipt.imported = {
    native_written: true,
    overall_only: false,
    feedback: FEEDBACK_REL,
    decisions: native.decisions.length,
    reviewer: native.reviewer,
    overall_note_zh: overallNote || null,
    dropped_submission_fields: lifted,
  };
  receipt.next_action_zh = '收件完成（原生 review-feedback.json 已写出）：**接着**跑 '
    + 'scripts/validate-review-feedback.mjs --feedback <审阅目录>/review-feedback.json --bundle <运行目录>/B4/review-bundle.json '
    + '—— 它才是"算不算门"的判据；**收件之前跑它一定失败**（它读的就是这份文件）。'
    + '然后按 stages/B4-full-review.md 处理。';
  return receipt;
}

export function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i]] = argv[i + 1];
  const surfaceFile = args['--surface']
    ? resolve(args['--surface'])
    : args['--review-dir'] ? resolve(args['--review-dir'], 'review-surface.json') : null;
  if (!surfaceFile || !existsSync(surfaceFile)) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: '用法：review-inbox.mjs --surface <review-surface.json>（或 --review-dir <审阅目录>）' })}\n`);
    return 2;
  }
  const receipt = importSubmission(surfaceFile);
  process.stdout.write(`${JSON.stringify(receipt, null, 1)}\n`);
  return receipt.ok ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('review-inbox.mjs')) process.exit(main());

/** 收据里"提交文件相对 surface"的写法（给调用方打印用）。 */
export function submissionsRel(surfaceFile) {
  return relative(dirname(resolve(surfaceFile)), resolve(dirname(resolve(surfaceFile)), SUBMISSIONS_REL)).split('\\').join('/');
}
