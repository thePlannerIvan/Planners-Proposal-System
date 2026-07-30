#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAudit, classifyAuditIssues, summarizeFacts } from './lib/final-fact-audit.mjs';

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) out[argv[index]] = argv[index + 1];
  return out;
}

const args = argsOf(process.argv.slice(2));
if (!args['--audit'] || !args['--copy']) {
  process.stdout.write(`${JSON.stringify({
    valid: false,
    error: '用法：validate-fact-audit.mjs --audit <fact-audit.json> --copy <proposal-draft.md>',
  })}\n`);
  process.exit(2);
}

const auditPath = resolve(args['--audit']);
const copyPath = resolve(args['--copy']);
if (!existsSync(auditPath)) {
  process.stdout.write(`${JSON.stringify({ valid: false, error: `事实审计不存在：${auditPath}` })}\n`);
  process.exit(2);
}

try {
  const stored = JSON.parse(readFileSync(auditPath, 'utf8'));
  if (stored.contract_version !== '2.0.0') throw new Error('fact-audit.json 必须为 2.0.0');
  const current = buildAudit({
    copyPath,
    sourceIndexPath: resolve(stored.source_index_path),
    materialsPath: resolve(stored.materials_path),
    sourceRoot: resolve(stored.source_root),
    previousAuditPath: auditPath,
  });
  const issues = classifyAuditIssues(current);
  const allowHumanReview = args['--allow-human-review'] === 'true';
  const valid = issues.hard_errors.length === 0
    && (allowHumanReview || issues.human_review_required.length === 0);
  process.stdout.write(`${JSON.stringify({
    contract: 'final-fact-audit/2.0.0',
    valid,
    reviewable: issues.hard_errors.length === 0,
    requires_human_review: issues.human_review_required.length > 0,
    summary: summarizeFacts(current.facts),
    errors: issues.hard_errors,
    human_review_required: issues.human_review_required,
  })}\n`);
  process.exit(valid ? 0 : 1);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ valid: false, error: error.message })}\n`);
  process.exit(2);
}
