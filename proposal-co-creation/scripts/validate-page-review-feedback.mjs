#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) out[argv[index]] = argv[index + 1];
  return out;
}
function finish(valid, errors, pages = 0) {
  process.stdout.write(`${JSON.stringify({ contract: 'co-creation-page-review/1.0.0', valid, pages, errors })}\n`);
  process.exit(valid ? 0 : 1);
}
const args = argsOf(process.argv.slice(2));
if (!args['--feedback'] || !args['--architecture']) {
  process.stdout.write(`${JSON.stringify({ valid: false, error: '用法：--feedback <review-feedback.json> --architecture <page_architecture.json>' })}\n`);
  process.exit(2);
}
let feedback;
let architecture;
let rawArchitecture;
try {
  feedback = JSON.parse(readFileSync(resolve(args['--feedback']), 'utf8'));
  rawArchitecture = readFileSync(resolve(args['--architecture']), 'utf8');
  architecture = JSON.parse(rawArchitecture);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ valid: false, error: error.message })}\n`);
  process.exit(2);
}
const errors = [];
const expectedHash = createHash('sha256').update(rawArchitecture).digest('hex');
if (feedback.contract_version !== '1.0.0') errors.push('contract_version 必须为 1.0.0');
if (feedback.review_kind !== 'co_creation_page_architecture') errors.push('review_kind 不匹配');
if (feedback.source_sha256 !== expectedHash) errors.push('反馈没有绑定当前 page_architecture.json');
if (!['approve', 'revise'].includes(feedback.overall_decision)) errors.push('overall_decision 无效');
if (!Array.isArray(feedback.decisions)) errors.push('decisions 必须为数组');
const expectedPages = architecture.pages.map(page => page.page_number);
const decisionPages = Array.isArray(feedback.decisions) ? feedback.decisions.map(item => item.page_number) : [];
if (new Set(decisionPages).size !== expectedPages.length
  || expectedPages.some(page => !decisionPages.includes(page))
  || decisionPages.some(page => !expectedPages.includes(page))) {
  errors.push('反馈必须恰好覆盖 Page Architecture 的每一页');
}
for (const item of feedback.decisions || []) {
  if (!['approve', 'revise'].includes(item.decision)) errors.push(`第 ${item.page_number} 页决定无效`);
  if (item.decision === 'revise' && !(item.feedback_zh || '').trim()) errors.push(`第 ${item.page_number} 页需要修改时必须填写反馈`);
}
const hasRevision = (feedback.decisions || []).some(item => item.decision === 'revise');
if (hasRevision && feedback.overall_decision !== 'revise') errors.push('存在需修改页面时 overall_decision 必须为 revise');
if (!hasRevision && feedback.overall_decision !== 'approve') errors.push('所有页面通过时 overall_decision 必须为 approve');
finish(errors.length === 0, errors, expectedPages.length);
