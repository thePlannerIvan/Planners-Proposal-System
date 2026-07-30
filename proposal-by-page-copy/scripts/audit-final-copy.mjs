#!/usr/bin/env node
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildAudit, classifyAuditIssues, splitVisiblePages, summarizeFacts,
} from './lib/final-fact-audit.mjs';

process.on('uncaughtException', error => {
  process.stdout.write(`${JSON.stringify({ valid: false, error: error.message })}\n`);
  process.exit(1);
});

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    const value = argv[index + 1];
    if (value && !value.startsWith('--')) {
      out[key] = value;
      index += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function required(args, keys) {
  for (const key of keys) if (!args[key]) throw new Error(`缺少 ${key}`);
}

function validatePrepareInputs(copyPath, sourceIndexPath, materialsPath, sourceRoot) {
  for (const [label, path] of [
    ['source-index', sourceIndexPath],
    ['page-material-packs', materialsPath],
    ['source-root', sourceRoot],
  ]) {
    if (!existsSync(path)) throw new Error(`${label} 不存在：${path}`);
  }
  const materialData = JSON.parse(readFileSync(materialsPath, 'utf8'));
  const packs = Array.isArray(materialData) ? materialData : materialData.packs || [];
  if (!packs.length) throw new Error('page-material-packs 没有任何页面材料包，必须先完成 P2');
  const sourceData = JSON.parse(readFileSync(sourceIndexPath, 'utf8'));
  const sourceRows = Array.isArray(sourceData) ? sourceData : sourceData.sources || sourceData.files || [];
  if (!sourceRows.length) throw new Error('source-index 没有任何来源，必须先完成 P1');
  const packedPages = new Set(packs.map(pack => Number(pack.page_number)));
  const copyPages = splitVisiblePages(readFileSync(copyPath, 'utf8')).map(page => page.page_number);
  const missingPages = copyPages.filter(page => !packedPages.has(page));
  if (missingPages.length) {
    throw new Error(`page-material-packs 缺少页面：${missingPages.join('、')}；必须先完成 P2`);
  }
}

function provisionalDecision(fact) {
  return {
    ...fact,
    semantic_status: (fact.items || []).some(item => item.kind === 'proposal_value')
      ? 'qualified' : 'verified',
    semantic_notes_zh: (fact.semantic_review_reasons || []).length ? '脚本临时机械检查' : '',
  };
}

function factIssues(fact, provisional = true) {
  return classifyAuditIssues({ facts: [provisional ? provisionalDecision(fact) : fact] });
}

function compactEvidence(fact) {
  const seen = new Set();
  const evidence = [];
  for (const item of fact.items || []) {
    if (!['sourced_fact', 'pending'].includes(item.kind)) continue;
    for (const candidate of (item.source_candidates || []).slice(0, 2)) {
      const key = `${candidate.source_path}\n${candidate.evidence_excerpt || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      evidence.push({
        source_id: candidate.source_id,
        source_path: candidate.source_path,
        locator: candidate.locator,
        mechanical_status: candidate.mechanical_status,
        excerpt: candidate.evidence_excerpt || '',
      });
      if (evidence.length >= 2) return evidence;
    }
  }
  return evidence;
}

function compactQueue(facts, provisional = true) {
  return facts
    .map(fact => ({ fact, issues: factIssues(fact, provisional) }))
    .filter(({ issues }) => issues.hard_errors.length || issues.human_review_required.length)
    .map(({ fact, issues }) => ({
        fact_id: fact.fact_id,
        page: fact.page_number,
        text: fact.claim_text,
        numbers: (fact.items || []).map(item => ({
          token_id: item.token_id,
          raw: item.raw,
          kind: item.kind,
          suggested_kind: item.suggested_kind,
          suggested_source: item.source_candidates[0]?.source_id || null,
          mechanical_status: item.mechanical_status,
        })),
        blocking_errors: issues.hard_errors,
        human_review_required: issues.human_review_required,
        evidence_candidates: compactEvidence(fact),
        carry_state: fact.carry_state,
      }));
}

function semanticQueue(facts) {
  return facts
    .filter(fact => fact.semantic_status === 'pending'
      && (fact.semantic_review_reasons || []).length > 0
      && factIssues(fact).hard_errors.length === 0)
    .map(fact => ({
      fact_id: fact.fact_id,
      page: fact.page_number,
      text: fact.claim_text,
      why_model_is_needed: fact.semantic_review_reasons,
      allowed_decisions: ['verified', 'qualified', 'fix_required', 'user_review_required'],
      evidence_candidates: compactEvidence(fact),
      numbers: (fact.items || []).map(item => ({
        token_id: item.token_id,
        raw: item.raw,
        kind: item.kind,
        suggested_kind: item.suggested_kind,
        classification_reason: item.classification_reason,
        source: item.source_path || null,
        mechanical_status: item.mechanical_status,
      })),
    }));
}

function buildFromStored(copyPath, auditPath) {
  const stored = JSON.parse(readFileSync(auditPath, 'utf8'));
  if (stored.contract_version !== '2.0.0') throw new Error('fact-audit.json 必须为 2.0.0');
  return buildAudit({
    copyPath,
    sourceIndexPath: resolve(stored.source_index_path),
    materialsPath: resolve(stored.materials_path),
    sourceRoot: resolve(stored.source_root),
    previousAuditPath: auditPath,
  });
}

function reviewQueuePayload(current, strict = false) {
  const blockingQueue = compactQueue(current.facts, !strict);
  const blockingIds = new Set(blockingQueue.map(item => item.fact_id));
  const semanticReviewQueue = semanticQueue(current.facts)
    .filter(item => !blockingIds.has(item.fact_id));
  return {
    contract_version: 'fact-audit-review-queue/1.0.0',
    copy_sha256: current.copy_sha256,
    audit_policy_version: current.audit_policy_version,
    instruction_zh: '只处理这里列出的模糊项。每条选择 verified、qualified、fix_required 或 user_review_required；不要补写机械字段。',
    semantic_review_queue: semanticReviewQueue,
    blocking_queue: blockingQueue,
  };
}

function writeReviewQueue(queuePath, current, strict = false) {
  const payload = reviewQueuePayload(current, strict);
  mkdirSync(dirname(queuePath), { recursive: true });
  writeFileSync(queuePath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function applyDecisions(stored, decisions) {
  if (decisions.contract_version !== 'fact-audit-decisions/1.0.0') {
    throw new Error('decisions 必须为 fact-audit-decisions/1.0.0');
  }
  if (decisions.copy_sha256 !== stored.copy_sha256) {
    throw new Error('decisions 没有绑定当前文案；请重新 prepare');
  }
  const facts = new Map((stored.facts || []).map(fact => [fact.fact_id, fact]));
  const sourceIndex = existsSync(stored.source_index_path)
    ? JSON.parse(readFileSync(stored.source_index_path, 'utf8'))
    : {};
  const sourceRows = Array.isArray(sourceIndex)
    ? sourceIndex
    : (sourceIndex.sources || sourceIndex.files || []);
  const allowedSourceIds = new Set();
  const allowedSourcePaths = new Set();
  for (const row of sourceRows) {
    const sourcePath = row.file_path || row.path || row.relative_path || null;
    const sourceId = row.source_id || row.id || sourcePath;
    if (sourceId) allowedSourceIds.add(sourceId);
    if (sourcePath) allowedSourcePaths.add(sourcePath);
  }
  const allowedStatuses = new Set(['verified', 'qualified', 'fix_required', 'user_review_required']);
  const allowedKinds = new Set(['sourced_fact', 'derived_fact', 'proposal_value', 'non_factual']);
  for (const decision of decisions.decisions || []) {
    const fact = facts.get(decision.fact_id);
    if (!fact) throw new Error(`未知 fact_id：${decision.fact_id}`);
    if (!allowedStatuses.has(decision.status)) throw new Error(`${decision.fact_id}: status 非法`);
    fact.semantic_status = decision.status;
    fact.semantic_notes_zh = String(decision.note_zh || '').trim();
    if (decision.status === 'user_review_required' && !fact.semantic_notes_zh) {
      throw new Error(`${decision.fact_id}: 提交用户决定必须说明不确定点`);
    }
    if ((fact.semantic_review_reasons || []).length && !fact.semantic_notes_zh) {
      throw new Error(`${decision.fact_id}: 模糊项必须写一句简短判断`);
    }
    const items = new Map((fact.items || []).map(item => [item.token_id, item]));
    for (const itemDecision of decision.items || []) {
      const item = items.get(itemDecision.token_id);
      if (!item) throw new Error(`${decision.fact_id}: 未知 token_id ${itemDecision.token_id}`);
      if (itemDecision.kind) {
        if (!allowedKinds.has(itemDecision.kind)) throw new Error(`${item.token_id}: kind 非法`);
        if (item.kind_locked && itemDecision.kind !== item.suggested_kind) {
          throw new Error(`${item.token_id}: 计算性质已锁定，不能改 kind`);
        }
        item.kind = itemDecision.kind;
      }
      if (itemDecision.source_id || itemDecision.source_path) {
        const previousSourceId = item.source_id;
        const previousSourcePath = item.source_path;
        const candidate = (item.source_candidates || []).find(value =>
          (itemDecision.source_id && value.source_id === itemDecision.source_id)
          || (itemDecision.source_path && value.source_path === itemDecision.source_path));
        if (!candidate
          && ((itemDecision.source_id && !allowedSourceIds.has(itemDecision.source_id))
            || (itemDecision.source_path && !allowedSourcePaths.has(itemDecision.source_path)))) {
          throw new Error(`${item.token_id}: 来源不在候选或 source-index 中`);
        }
        item.source_id = candidate?.source_id || itemDecision.source_id || null;
        item.source_path = candidate?.source_path || itemDecision.source_path || null;
        item.locator = candidate?.locator || itemDecision.locator || '';
        if (item.source_id !== previousSourceId || item.source_path !== previousSourcePath) {
          item.source_sha256 = null;
          item.mechanical_status = 'unresolved';
          item.matched_numeric_tokens = [];
          item.missing_numeric_tokens = [item.raw];
        }
      }
      if (itemDecision.derivation) item.derivation = itemDecision.derivation;
    }
  }
  return stored;
}

const args = argsOf(process.argv.slice(2));
const mode = args['--mode'] || 'prepare';
required(args, ['--copy', '--audit']);
const copyPath = resolve(args['--copy']);
const auditPath = resolve(args['--audit']);
const queuePath = args['--queue']
  ? resolve(args['--queue'])
  : resolve(dirname(auditPath), 'fact-audit-review-queue.json');

if (mode === 'prepare') {
  required(args, ['--source-index', '--materials', '--source-root']);
  const sourceIndexPath = resolve(args['--source-index']);
  const materialsPath = resolve(args['--materials']);
  const sourceRoot = resolve(args['--source-root']);
  validatePrepareInputs(copyPath, sourceIndexPath, materialsPath, sourceRoot);
  const current = buildAudit({
    copyPath,
    sourceIndexPath,
    materialsPath,
    sourceRoot,
    previousAuditPath: existsSync(auditPath) ? auditPath : null,
  });
  mkdirSync(dirname(auditPath), { recursive: true });
  writeFileSync(auditPath, `${JSON.stringify(current, null, 2)}\n`);
  const reviewQueue = writeReviewQueue(queuePath, current);
  process.stdout.write(`${JSON.stringify({
    valid: true,
    mode,
    summary: current.summary,
    blocking_queue_count: reviewQueue.blocking_queue.length,
    semantic_review_queue_count: reviewQueue.semantic_review_queue.length,
    output: auditPath,
    review_queue: queuePath,
  })}\n`);
  process.exit(0);
}

if (mode === 'resolve') {
  required(args, ['--decisions']);
  if (!existsSync(auditPath)) throw new Error(`事实审计不存在：${auditPath}`);
  const stored = JSON.parse(readFileSync(auditPath, 'utf8'));
  const decisions = JSON.parse(readFileSync(resolve(args['--decisions']), 'utf8'));
  writeFileSync(auditPath, `${JSON.stringify(applyDecisions(stored, decisions), null, 2)}\n`);
  const current = buildFromStored(copyPath, auditPath);
  current.summary = summarizeFacts(current.facts);
  writeFileSync(auditPath, `${JSON.stringify(current, null, 2)}\n`);
  const reviewQueue = writeReviewQueue(queuePath, current);
  const issues = classifyAuditIssues(current);
  process.stdout.write(`${JSON.stringify({
    valid: issues.hard_errors.length === 0 && issues.human_review_required.length === 0,
    reviewable: issues.hard_errors.length === 0,
    requires_human_review: issues.human_review_required.length > 0,
    mode,
    summary: current.summary,
    hard_error_count: issues.hard_errors.length,
    human_review_required_count: issues.human_review_required.length,
    remaining_semantic_review_queue_count: reviewQueue.semantic_review_queue.length,
    output: auditPath,
    review_queue: queuePath,
  })}\n`);
  process.exit(issues.hard_errors.length ? 1 : 0);
}

if (mode === 'confirm') {
  if (!existsSync(auditPath)) throw new Error(`事实审计不存在：${auditPath}`);
  const current = buildFromStored(copyPath, auditPath);
  let confirmed = 0;
  current.facts = current.facts.map(fact => {
    if (fact.semantic_status !== 'pending'
      || (fact.semantic_review_reasons || []).length > 0
      || factIssues(fact).hard_errors.length > 0) return fact;
    confirmed += 1;
    return provisionalDecision(fact);
  });
  current.summary = summarizeFacts(current.facts);
  writeFileSync(auditPath, `${JSON.stringify(current, null, 2)}\n`);
  const reviewQueue = writeReviewQueue(queuePath, current, true);
  process.stdout.write(`${JSON.stringify({
    valid: true,
    mode,
    confirmed,
    summary: current.summary,
    remaining_attention_count: reviewQueue.blocking_queue.length + reviewQueue.semantic_review_queue.length,
    output: auditPath,
  })}\n`);
  process.exit(0);
}

if (mode === 'check') {
  if (!existsSync(auditPath)) throw new Error(`事实审计不存在：${auditPath}`);
  const current = buildFromStored(copyPath, auditPath);
  const issues = classifyAuditIssues(current);
  writeReviewQueue(queuePath, current, true);
  process.stdout.write(`${JSON.stringify({
    valid: issues.hard_errors.length === 0 && issues.human_review_required.length === 0,
    reviewable: issues.hard_errors.length === 0,
    requires_human_review: issues.human_review_required.length > 0,
    mode,
    summary: summarizeFacts(current.facts),
    hard_error_count: issues.hard_errors.length,
    human_review_required_count: issues.human_review_required.length,
    review_queue: queuePath,
  })}\n`);
  process.exit(issues.hard_errors.length ? 1 : 0);
}

throw new Error('--mode 必须为 prepare、resolve、confirm 或 check');
