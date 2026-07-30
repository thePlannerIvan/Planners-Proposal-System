#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateAgainstSchema, validateFile } from './lib/contract-validation.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
if (!args['--feedback'] || !args['--bundle']) process.exit(2);
const feedbackPath = resolve(args['--feedback']);
const bundlePath = resolve(args['--bundle']);
const result = validateFile(feedbackPath, resolve(import.meta.dirname, '../contracts/review-feedback.schema.json'));
if (result.valid) {
  const feedback = JSON.parse(readFileSync(feedbackPath, 'utf8'));
  const bundleRaw = readFileSync(bundlePath, 'utf8');
  const bundle = JSON.parse(bundleRaw);
  const expectedHash = createHash('sha256').update(bundleRaw).digest('hex');
  const curationSchema = JSON.parse(readFileSync(resolve(import.meta.dirname, '../contracts/library-curation.schema.json'), 'utf8'));
  if (feedback.review_bundle_sha256 !== expectedHash) result.errors.push('review_bundle_sha256 与实际审阅包不一致');
  if (feedback.route !== bundle.route) result.errors.push('route 与审阅包不一致');
  const byId = new Map(feedback.decisions.map(item => [item.item_id, item]));
  if (byId.size !== feedback.decisions.length) result.errors.push('反馈含重复 item_id');
  for (const item of bundle.items) {
    const decision = byId.get(item.item_id);
    if (!decision) { result.errors.push(`未处置：${item.item_id}`); continue; }
    if (!item.allowed_decisions.includes(decision.decision)) result.errors.push(`${item.item_id}: 决定 ${decision.decision} 不适用于当前路线`);
    if (['merge', 'variant', 'revision', 'add_source', 'no_change'].includes(decision.decision)) {
      if (!decision.target_id || (item.method_kind === 'lens' && !decision.target_module_id)) result.errors.push(`${item.item_id}: 必须明确目标方法`);
      if (!item.merge_targets.some(target => target.target_id === decision.target_id && (target.module_id || null) === (decision.target_module_id || null))) result.errors.push(`${item.item_id}: 目标不在已打开审阅页的可选列表中`);
    }
    if (decision.decision === 'reroute' && !item.module_targets.some(target => target.module_id === decision.target_module_id)) result.errors.push(`${item.item_id}: reroute 必须选择已有目标 Module`);
    if (['revise', 'merge', 'revision'].includes(decision.decision) && !decision.edited_proposal) {
      result.errors.push(`${item.item_id}: ${decision.decision} 必须给出人工确认后的完整 edited_proposal`);
    }
    if (decision.edited_proposal) {
      const schema = item.method_kind === 'lens' ? curationSchema.$defs.lens : curationSchema.$defs.recipe;
      validateAgainstSchema(decision.edited_proposal, schema, curationSchema, `${item.item_id}.edited_proposal`, result.errors);
      const idKey = item.method_kind === 'lens' ? 'lens_id' : 'recipe_id';
      if (decision.edited_proposal[idKey] !== item.source_id) result.errors.push(`${item.item_id}: edited_proposal 必须保留冻结 ${idKey} ${item.source_id}`);
    }
  }
  for (const id of byId.keys()) if (!bundle.items.some(item => item.item_id === id)) result.errors.push(`反馈含未知 item_id：${id}`);

  const lensResolution = new Map();
  for (const item of bundle.items.filter(item => item.method_kind === 'lens')) {
    const decision = byId.get(item.item_id);
    if (!decision || ['reject', 'defer'].includes(decision.decision)) continue;
    const proposal = decision.edited_proposal || item.proposal;
    const resolvedId = ['merge', 'variant', 'revision', 'add_source', 'no_change'].includes(decision.decision)
      ? decision.target_id
      : proposal.lens_id;
    if (resolvedId) lensResolution.set(item.source_id, resolvedId);
  }
  for (const item of bundle.items.filter(item => item.method_kind === 'recipe')) {
    const decision = byId.get(item.item_id);
    if (!decision || !['approve', 'revise', 'new', 'revision'].includes(decision.decision)) continue;
    const proposal = decision.edited_proposal || item.proposal;
    const dependencies = new Set([...(proposal.required_lens_ids || []), ...(proposal.optional_lens_ids || []), ...(proposal.steps || []).map(step => step.lens_id)]);
    for (const lensId of dependencies) {
      if (!lensResolution.has(lensId)) result.errors.push(`${item.item_id}: Recipe 依赖 ${lensId} 未获批准、被暂缓或被拒绝`);
    }
  }
}
result.valid = result.errors.length === 0;
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.valid ? 0 : 1);
