#!/usr/bin/env node
/**
 * B4 方法库审阅面的 **surface 文档**（业务）＋写盘＋校验。宿主生命周期不在这里（模组 Node CLI）。
 *
 * 这一家的原生记录叫 `review-feedback.json`，形状是
 * `{contract_version, review_bundle_sha256, route, saved_at, reviewer, decisions[]}`。
 * 页面提交落在 `review-submissions.json`（**提交文件**），由收件层翻译回原生形状 —— 原生形状一个字段不动。
 *
 * **`dir` 为什么是 `..`（而不是页面自己那一层）**：页面要用 `review.readText('review-bundle.json')`
 * 读回**磁盘上那一份**审阅包，才能核对"我绑定的哈希还是不是当前这一份"。审阅包在
 * `<run>/B4/review-bundle.json`，页面在 `<run>/B4/review/index.html` —— 最近公共祖先就是 `B4/`，
 * 于是 `dir: '..'`、`entry: 'review/index.html'`。这与公共契约里 `dir` 的定义一致
 * （被 serve 的那棵树），不是绕过。`watch` 是唯一相对 surface 文件的路径字段，这里没声明。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { moduleScript } from './lib/planners-modules.mjs';

export const SURFACE_REL = 'review-surface.json';
export const SUBMISSIONS_REL = 'review-submissions.json';
export const FEEDBACK_REL = 'review-feedback.json';
export const CONTEXT_REL = 'review-context.json';
export const ID = 'planners-proposal-system/library';
/** 入口相对 `dir` 的路径：审阅页永远在 `review/` 子目录里。 */
export const ENTRY_REL = 'review/index.html';

export const surfacePath = (reviewDir) => join(resolve(reviewDir), SURFACE_REL);
export const submissionsPath = (reviewDir) => join(resolve(reviewDir), SUBMISSIONS_REL);
export const feedbackPath = (reviewDir) => join(resolve(reviewDir), FEEDBACK_REL);
export const contextPath = (reviewDir) => join(resolve(reviewDir), CONTEXT_REL);

export function surfaceDocument(reviewDir, options = {}) {
  return {
    contract_version: 'review-surface/2.0.0',
    id: ID,
    title: options.title || 'B4 方法库完整审阅',
    description: '逐项审阅冻结 Lens / Recipe 与 Module 归属；也可以不针对任何一个方法，只说一句整体意见。',
    // 被 serve 的树 = 审阅目录的上一级（B4/），入口在 review/ 里。见文件头注释。
    project_root: options.projectRoot || '../..',
    dir: options.dir || '..',
    entry: options.entry || ENTRY_REL,
    feedback: SUBMISSIONS_REL,
    wake: {
      mode: 'queue',
      text: '方法库审阅有新的提交（{unit}）：先跑 scripts/review-inbox.mjs 收件'
        + '（它把提交翻译成 review-feedback.json，并把页面报上来的前提与整体意见放进收据），'
        + '**收件之后**再跑 scripts/validate-review-feedback.mjs --feedback <审阅目录>/review-feedback.json'
        + ' --bundle <运行目录>/B4/review-bundle.json（门在收件之后，顺序被钉住），'
        + '然后按 stages/B4-full-review.md 处理。',
    },
    // 这个面不上传替换素材（页面里 0 处上传控件），所以什么都不声明。
    capabilities: [],
  };
}

export function writeSurface(reviewDir, options) {
  const target = surfacePath(reviewDir);
  mkdirSync(dirname(target), { recursive: true });
  const payload = `${JSON.stringify(surfaceDocument(reviewDir, options), null, 2)}\n`;
  if (!existsSync(target) || readFileSync(target, 'utf8') !== payload) writeFileSync(target, payload, 'utf8');
  return target;
}

export function validateSurface(reviewDir) {
  const target = surfacePath(reviewDir);
  if (!existsSync(target)) throw new Error(`还没有审阅面：先写 surface，写出 ${target}`);
  const result = spawnSync(process.execPath,
    [moduleScript('planners-review-core', 'scripts/validate-surface.mjs'), target, '--text'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`审阅面不合规（${target}）：\n${(result.stdout || result.stderr).trim()}`);
  return { ok: true, output: (result.stdout || '').trim() };
}

/** 只写 surface + 校验，不起宿主（给"我没有浏览器/只想先拿路径"的调用方）。 */
export function surfaceOnly(reviewDir, options = {}) {
  const target = writeSurface(reviewDir, options);
  const report = validateSurface(reviewDir);
  return {
    status: 'surface_ready',
    surface: resolve(target),
    entry: resolve(reviewDir, 'index.html'),
    submissions: submissionsPath(reviewDir),
    host_started: false,
    validator: report.output.split('\n').at(-1),
    next_action_zh: '把 surface 的绝对路径交给宿主的 review_open 工具（有插件时）；没有那个工具时用模组的无插件宿主起本地服务。',
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i]] = argv[i + 1];
  if (!args['--review-dir']) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: '用法：review-surface.mjs --review-dir <审阅目录>' })}\n`);
    return 2;
  }
  try {
    const result = surfaceOnly(resolve(args['--review-dir']), {});
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 1)}\n`);
    return 0;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: String(error.message || error) }, null, 1)}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) process.exit(main());

export function resolveSurfacePaths(surfaceFile) {
  const surface = resolve(surfaceFile);
  const doc = JSON.parse(readFileSync(surface, 'utf8'));
  const base = dirname(surface);
  const dir = resolve(base, String(doc.dir || '.'));
  return {
    surface,
    doc,
    dir,
    entry: resolve(dir, String(doc.entry)),
    submissions: doc.feedback ? resolve(base, String(doc.feedback)) : null,
    feedback: doc.feedback ? resolve(base, String(doc.feedback)) : null,
    projectRoot: resolve(base, String(doc.project_root || '.')),
    contentHash: createHash('sha256').update(readFileSync(surface)).digest('hex').slice(0, 12),
  };
}
