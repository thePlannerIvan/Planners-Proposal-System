#!/usr/bin/env node
/**
 * Proposal 的 Storyline 校验：在 planners-doc/2 之上，只加提案自己的两条内容规则。
 *
 * 用法：node validate-storyline-doc.mjs <storyline.md> [--text]
 *
 * 它不另造解析器：
 *   · 结构校验（文档头、章节/页/标题块层级、锚点、图片、空页、页末出处）交给 planners-review-core 的
 *     `scripts/validate-doc.mjs`，回执与退出码原样合并；
 *   · 提案规则复用同一个切块实现 `scripts/lib/doc-blocks.mjs` 的 parseDocument，
 *     只读 pages[].blocks，不重新切一遍 Markdown。
 *
 * 它加的规则（只评价「每页有没有把主张与支撑写出来」，不评价判断对不对）：
 *   · 每页用一段以「主张：」开头的正文写一句完整判断；
 *   · 每页至少一条列表项支撑，写在页内标题块（`###`–`######`）之前；
 *   · 一页只有一句主张，且主张写在支撑之前。
 * 两三条支撑是写作指引，不是硬限制：只有一条或超过四条时给警告，不阻断。
 *
 * 退出码与公共校验器一致：0 合规（可有警告）、1 不合规、2 用法或依赖错误。
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { moduleScript } from './lib/planners-modules.mjs';

const CONTRACT = 'planners-doc/2';
const CLAIM_RE = /^主张[：:]/;

const usage = () => {
  console.error('用法：node validate-storyline-doc.mjs <storyline.md> [--text]');
  process.exit(2);
};

const args = process.argv.slice(2);
if (args.some((arg) => arg.startsWith('--') && arg !== '--text')) usage();
const file = args.find((arg) => !arg.startsWith('--'));
if (!file) usage();
const docPath = resolve(file);
if (!existsSync(docPath) || !statSync(docPath).isFile()) {
  console.error(`找不到文档：${docPath}`);
  process.exit(2);
}

/** 依赖缺失、公共校验器跑不起来，都是「用法/环境错误」，回执仍然可读。 */
const failSetup = (message) => {
  console.error(message);
  process.exit(2);
};

let coreValidator;
let parseDocument;
let TYPE_NAMES;
try {
  coreValidator = moduleScript('planners-review-core', 'scripts/validate-doc.mjs');
  ({ parseDocument, TYPE_NAMES } = await import(pathToFileURL(
    moduleScript('planners-review-core', 'scripts/lib/doc-blocks.mjs'))));
} catch (error) {
  failSetup(`无法加载 planners-review-core：${error.message}`);
}

// ① 结构：公共校验器说了算，不复制它的错误码。
const structural = spawnSync(process.execPath, [coreValidator, docPath], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
  env: process.env,
});
if (structural.status === 2) {
  process.stderr.write(structural.stderr || `无法校验：${docPath}\n`);
  process.exit(2);
}
if (structural.status !== 0 && structural.status !== 1) {
  failSetup(`planners-review-core 的 validate-doc.mjs 没有正常结束：${structural.stderr || structural.status}`);
}
let receipt;
try {
  receipt = JSON.parse(structural.stdout);
} catch {
  failSetup(`planners-review-core 的 validate-doc.mjs 没有返回 JSON：${structural.stdout.slice(0, 400)}`);
}

// ② 提案规则：用的是同一个 parseDocument，只读已经切好的 pages / blocks。
const parsed = parseDocument(readFileSync(docPath, 'utf8'), { checkImages: false });
const errors = [];
const warnings = [];
let claims = 0;
let supports = 0;

// 这套规则只服务 storyline；by-page 有自己的内容形态，不套用「每页一句主张」。
const isStoryline = !parsed.front.doc || parsed.front.doc === 'storyline';
if (!isStoryline) {
  errors.push({
    code: 'doc_kind',
    message: `这是 ${parsed.front.doc} 工作稿；提案校验只检查 storyline`,
    line: 2,
    page: null,
    block: null,
  });
}

const blockLabel = (block) => block?.anchor
  ?? `第 ${block?.index ?? '?'} 块（${TYPE_NAMES?.[block?.type] ?? block?.type ?? '块'}）`;
const pageLabel = (page) => `章节「${page.chapter?.title ?? '未分章'}」第 ${page.index} 页「${page.title}」`;
const fail = (code, message, block, label) => errors.push({
  code, message, line: block?.startLine ?? null, page: label, block: blockLabel(block),
});

for (const page of (isStoryline ? parsed.pages : [])) {
  const label = pageLabel(page);
  // 页内标题块（`### 依据与边界` 之类）之后不再是主张与支撑的地盘；出处是页末引用，不是列表。
  const firstSection = page.blocks.findIndex((block) => block.type === 'heading');
  const body = firstSection === -1 ? page.blocks : page.blocks.slice(0, firstSection);
  const pageClaims = body.filter((block) => block.type === 'paragraph' && CLAIM_RE.test(block.raw.trimStart()));
  const pageSupports = body.filter((block) => block.type === 'list');
  const claim = pageClaims[0] ?? null;
  claims += pageClaims.length;
  supports += pageSupports.length;

  if (!claim) {
    errors.push({
      code: 'page_claim_missing',
      message: '每页要有一句主张：用一段以「主张：」开头的正文写，放在支撑之前、页内标题块之前',
      line: page.line,
      page: label,
      block: null,
    });
  } else {
    const text = claim.raw.trimStart().replace(CLAIM_RE, '').trim();
    if (!text) fail('page_claim_empty', '「主张：」后面没有内容', claim, label);
    if (pageClaims.length > 1) {
      fail('page_claim_multiple', `一页只能有一句主张，这一页出现了 ${pageClaims.length} 处「主张：」`, pageClaims[1], label);
    }
    if (pageSupports.some((block) => block.startLine < claim.startLine)) {
      fail('page_claim_after_support', '主张要写在支撑之前', claim, label);
    }
    if (pageSupports.length === 0) {
      errors.push({
        code: 'page_support_missing',
        message: '每页至少一条支撑：用列表项说明主张为什么成立',
        line: page.line,
        page: label,
        block: blockLabel(claim),
      });
    } else if (pageSupports.length === 1) {
      warnings.push({
        code: 'page_support_single',
        message: '只有一条支撑，通常写两三条更有说服力',
        line: pageSupports[0].startLine,
        page: label,
        block: blockLabel(pageSupports[0]),
      });
    } else if (pageSupports.length > 4) {
      warnings.push({
        code: 'page_supports_many',
        message: `一页有 ${pageSupports.length} 条支撑，考虑拆页或删减`,
        line: claim.startLine,
        page: label,
        block: blockLabel(claim),
      });
    }
  }
}

const allErrors = [...receipt.errors, ...errors].sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || a.code.localeCompare(b.code));
const allWarnings = [...receipt.warnings, ...warnings].sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || a.code.localeCompare(b.code));
const checked = { ...receipt.checked, claims, supports };
const valid = allErrors.length === 0;

if (args.includes('--text')) {
  for (const warning of allWarnings) {
    const where = [warning.line ? `行 ${warning.line}` : null, warning.page, warning.block].filter(Boolean).join(' · ');
    console.log(`WARN  [${warning.code}] ${where ? `${where}：` : ''}${warning.message}`);
  }
  for (const error of allErrors) {
    const where = [error.line ? `行 ${error.line}` : null, error.page, error.block].filter(Boolean).join(' · ');
    console.log(`ERROR [${error.code}] ${where ? `${where}：` : ''}${error.message}`);
  }
  console.log(valid
    ? `\n合规：${checked.chapters} 章 ${checked.pages} 页、${claims} 句主张、${supports} 条支撑；${allWarnings.length} 个警告`
    : `\n不合规：${allErrors.length} 个错误、${allWarnings.length} 个警告`);
} else {
  console.log(JSON.stringify({ contract: CONTRACT, valid, errors: allErrors, warnings: allWarnings, checked }, null, 2));
}
process.exit(valid ? 0 : 1);
