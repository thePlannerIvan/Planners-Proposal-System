#!/usr/bin/env node
/**
 * 收件：把审阅面提交的那**一份**文件翻译回本子 Skill 的原生形状 `review-feedback.json`。
 *
 * 为什么需要这一层：旧的 `/save-feedback` 处理器做三件事 —— ①按固定规则校验 ②原样落盘
 * ③把上传的图片写进 `<assets_dir>/page-NN/`。上缝之后页面只把提交交给宿主落盘，
 * 所以 ①②③ 全搬到这里；**原生形状一个字段不改**（提交里只有"缝自己"的字段会被摘掉）。
 *
 * 顺序是**被钉住的**：`validate-page-review-feedback.mjs`（门）必须在收件**之后**跑 ——
 * 它读的是本层写出来的 `review-feedback.json`，收件之前它看不到这一轮。收据里写明这件事。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { CONTEXT_REL, FEEDBACK_REL, contextPath, feedbackPath, resolveSurfacePaths } from './review-surface.mjs';
import {contentHash,prepareEdits,commitEdits} from './lib/review-edits.mjs';

/** 提交里属于"缝/页面"的东西：进收据，不进原生记录。 */
const SUBMISSION_ONLY = ['pre_check', 'pre_check_note', 'reviewState', 'review_changes'];
const MIME_EXT = new Map([['image/png', '.png'], ['image/jpeg', '.jpg'], ['image/webp', '.webp'], ['image/gif', '.gif']]);

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

/** 与旧 `/save-feedback` 处理器逐条对齐的校验（规则没改，只是换了位置）。 */
function problems(doc) {
  const out = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['提交不是对象'];
  if (!['1.0.0', '1.1.0'].includes(doc.contract_version)) out.push('contract_version 必须是 1.0.0 / 1.1.0');
  if (typeof doc.review_kind !== 'string' || !doc.review_kind) out.push('review_kind 必须是字符串');
  if (doc.review_kind && doc.review_kind !== 'co_creation_page_architecture') {
    out.push('review_kind 必须是 co_creation_page_architecture（实际 ' + doc.review_kind + '）');
  }
  if (!/^[a-f0-9]{64}$/.test(doc.source_sha256 || '')) out.push('source_sha256 必须是 64 位小写十六进制');
  if (!['approve', 'revise'].includes(doc.overall_decision)) out.push('overall_decision 必须是 approve / revise');
  if (typeof doc.saved_at !== 'string') out.push('saved_at 必须是字符串');
  if (!Array.isArray(doc.decisions) || !doc.decisions.length) out.push('decisions 必须是非空数组');
  for (const item of doc.decisions || []) {
    const at = '第 ' + (item && item.page_number) + ' 页';
    if (!Number.isInteger(item && item.page_number)) { out.push('page_number 必须是整数'); continue; }
    if (!['approve', 'revise'].includes(item.decision)) out.push(at + '的决定无效');
    if (typeof item.feedback_zh !== 'string') out.push(at + '的 feedback_zh 必须是字符串');
    if (item.attachments !== undefined) {
      if (!Array.isArray(item.attachments)) out.push(at + '的 attachments 必须是数组');
      else for (const asset of item.attachments) {
        if (typeof asset.path !== 'string' || typeof asset.alt !== 'string' || typeof asset.caption !== 'string') {
          out.push(at + '的附件必须带 path / alt / caption');
        }
      }
    }
  }
  return out;
}

/** 上传的替换图：从审阅目录搬到配置的素材目录，保持老布局 `page-NN/<文件名>`。 */
function importUploads(submission, reviewDir, context, receipt) {
  const assetsDir = context.assetsDir ? resolve(context.assetsDir) : null;
  const moved = [];
  for (const item of submission.decisions || []) {
    for (const asset of item.attachments || []) {
      const source = resolve(reviewDir, asset.path);
      if (!existsSync(source)) continue;
      if (!assetsDir) { moved.push({ page: item.page_number, path: asset.path, moved: false, reason: '没有配置素材目录：文件留在审阅目录里' }); continue; }
      const pageDir = join(assetsDir, 'page-' + String(item.page_number).padStart(2, '0'));
      mkdirSync(pageDir, { recursive: true });
      let target = join(pageDir, basename(source));
      for (let index = 2; existsSync(target) && resolve(target) !== source; index += 1) {
        const ext = target.slice(target.lastIndexOf('.'));
        target = join(pageDir, basename(source, ext) + '-' + index + ext);
      }
      if (resolve(target) !== source) renameSync(source, target);
      // 单一基准：附件路径一律**相对反馈文件所在目录**解析（消费者就是这么读的）。
      asset.path = relative(reviewDir, target).split('\\').join('/');
      if (typeof asset.url === 'string') asset.url = asset.path;
      moved.push({ page: item.page_number, path: asset.path, moved: resolve(target) !== source });
    }
  }
  if (moved.length) receipt.uploads = moved;
}

export function importSubmission(surfaceFile) {
  const paths = resolveSurfacePaths(surfaceFile);
  const reviewDir = paths.dir;
  const receipt = {
    ok: true, surface: paths.surface, review_dir: reviewDir,
    submissions: paths.submissions, feedback: feedbackPath(reviewDir),
    imported: null, rejected: [],
  };
  if (!paths.submissions || !existsSync(paths.submissions)) {
    receipt.skipped = '还没有提交：' + String(paths.submissions);
    receipt.next_action_zh = '作者还没在审阅页上保存（或宿主还没落盘）。';
    return receipt;
  }
  let submission;
  try { submission = readJson(paths.submissions); }
  catch (error) { receipt.ok = false; receipt.rejected.push('提交文件不是合法 JSON：' + error.message); return receipt; }
  const found = problems(submission);
  if (found.length) {
    receipt.ok = false; receipt.rejected.push(...found);
    receipt.next_action_zh = '这份提交没被收下（形状不合本面的契约）—— 上面每条都说明哪里不对。';
    return receipt;
  }
  const context = existsSync(contextPath(reviewDir)) ? readJson(contextPath(reviewDir)) : {};
  const cursorPath = join(reviewDir,'.inbox-cursor.json');
  const cursor = existsSync(cursorPath) ? readJson(cursorPath) : {imported:[]};
  const digest = contentHash(submission);
  if (cursor.imported.includes(digest)) { receipt.skipped = '这份提交已经收过'; return receipt; }
  let prepared;
  try { prepared = prepareEdits(submission,reviewDir); }
  catch (error) { receipt.ok = false; receipt.rejected.push(error.message); receipt.next_action_zh = '提交和草稿仍在；先核对原文与用户修改，不得覆盖。'; return receipt; }
  // R5b：页面知道、但机器看不见的前提 —— 进收据，不进原生记录。
  if (submission.reviewState && typeof submission.reviewState === 'object') receipt.review_state = submission.reviewState;
  if (submission.pre_check === false) {
    receipt.pre_check = false;
    receipt.pre_check_note = String(submission.pre_check_note || '提交方声明：没有经过版本前置核对。');
  }
  if (context.sourceSha256 && submission.source_sha256 && context.sourceSha256 !== submission.source_sha256) {
    receipt.hash_mismatch = { submission: submission.source_sha256.slice(0, 12), context: context.sourceSha256.slice(0, 12) };
  }
  importUploads(submission, reviewDir, context, receipt);

  // 原生形状：原样落盘（旧 handler 就是原样写）+ 只摘掉"缝自己"的字段。
  const native = { ...submission };
  for (const key of SUBMISSION_ONLY) delete native[key];
  if (prepared) {
    native.source_sha256 = prepared.sourceHash;
    native.decisions = native.decisions.map(d => ({...d,page_number:prepared.mapping.get(d.page_number)})).sort((a,b) => a.page_number-b.page_number);
    commitEdits(prepared,reviewDir);
    cursor.applied_draft = contentHash({edits:prepared.changes.edits,page_order:prepared.changes.page_order,section_order:prepared.changes.section_order});
    receipt.content_changed = prepared.changed; receipt.page_mapping = Object.fromEntries(prepared.mapping);
  }
  const target = feedbackPath(reviewDir);
  if (existsSync(target)) receipt.previous_latest = readJson(target) ? 'review-feedback.json 已被这一轮覆盖（本面原生只有"最新一轮"这一份，旧 launcher 的语义）' : null;
  writeFileSync(target, JSON.stringify(native, null, 2) + '\n', 'utf8');
  cursor.imported = [...cursor.imported,digest].slice(-200);
  writeFileSync(cursorPath,JSON.stringify(cursor,null,2)+'\n');
  receipt.units = { count: native.decisions.length, label: '页' };
  receipt.imported = {
    feedback: FEEDBACK_REL,
    review_kind: native.review_kind,
    pages: native.decisions.length,
    overall_decision: native.overall_decision,
    source_sha256: native.source_sha256,
    dropped_submission_fields: SUBMISSION_ONLY.filter((key) => key in submission),
  };
  receipt.next_action_zh = '收件完成（原生 review-feedback.json 已写出）：**接着**跑 scripts/validate-page-review-feedback.mjs —— 它才是"算不算门"的判据；'
    + '**收件之前跑它一定失败**（它读的就是这份文件）。然后按根 SKILL.md 的「审阅与修改」处理。';
  return receipt;
}

export function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i]] = argv[i + 1];
  const surfaceFile = args['--surface']
    ? resolve(args['--surface'])
    : args['--review-dir'] ? join(resolve(args['--review-dir']), 'review-surface.json') : null;
  if (!surfaceFile || !existsSync(surfaceFile)) {
    process.stdout.write(JSON.stringify({ ok: false, error: '用法：review-inbox.mjs --surface <review-surface.json>（或 --review-dir <审阅目录>）' }) + '\n');
    return 2;
  }
  const receipt = importSubmission(surfaceFile);
  process.stdout.write(JSON.stringify(receipt, null, 1) + '\n');
  return receipt.ok ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('review-inbox.mjs')) process.exit(main());
