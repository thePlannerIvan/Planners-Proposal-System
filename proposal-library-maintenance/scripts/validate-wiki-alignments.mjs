#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateFile, parseArtifact } from './lib/contract-validation.mjs';
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
const input = args['--input'];
if (!input) process.exit(2);
const result = validateFile(resolve(input), resolve(import.meta.dirname, '../contracts/wiki-change-candidate.schema.json'));
if (result.valid) {
  const declared = parseArtifact(resolve(input)).records[0];
  for (const change of declared.changes) {
    if (['merge', 'variant', 'revision', 'add_source', 'no_change'].includes(change.recommended_action) && !change.target_id) result.errors.push(`${change.item_id}: ${change.recommended_action} 必须给出 target_id`);
    if (change.method_kind === 'lens' && ['merge', 'variant', 'revision', 'add_source', 'reroute', 'no_change'].includes(change.recommended_action) && !change.target_module_id) result.errors.push(`${change.item_id}: Lens 的 ${change.recommended_action} 必须给出 target_module_id`);
    if (change.recommended_action === 'new' && change.target_id) result.errors.push(`${change.item_id}: new 不得绑定 target_id`);
  }
  if (args['--curation']) {
    const curationPath = resolve(args['--curation']);
    const curation = parseArtifact(curationPath).records[0];
    const curationHash = createHash('sha256').update(readFileSync(curationPath)).digest('hex');
    if (declared.curation_sha256 !== curationHash) result.errors.push('curation_sha256 与当前冻结 curation 不一致');
    const expected = new Set([...curation.modules.flatMap(module => module.lenses.map(lens => lens.lens_id)), ...curation.recipes.map(recipe => recipe.recipe_id)]);
    const actual = new Set(declared.changes.map(change => change.source_id));
    for (const id of expected) if (!actual.has(id)) result.errors.push(`缺少 Wiki 对照：${id}`);
    for (const id of actual) if (!expected.has(id)) result.errors.push(`对照引用未知冻结对象：${id}`);
    if (args['--snapshot']) {
      const snapshot = parseArtifact(resolve(args['--snapshot'])).records[0];
      const index = snapshot.artifacts.find(item => item.path === 'wiki-index.json');
      if (!index || declared.active_wiki_index_sha256 !== index.sha256) result.errors.push('active_wiki_index_sha256 与当前 Wiki snapshot 不一致');
      const lensTargets = new Map();
      const recipeTargets = new Set();
      for (const artifact of snapshot.artifacts) {
        if (artifact.path.startsWith('modules/')) {
          for (const lens of artifact.content?.lens_catalog || []) lensTargets.set(lens.lens_id, artifact.content.module_id);
        }
        if (artifact.path === 'wiki-recipes.json') for (const recipe of artifact.content?.recipes || []) recipeTargets.add(recipe.recipe_id);
      }
      for (const change of declared.changes) {
        const targets = change.method_kind === 'lens' ? lensTargets : recipeTargets;
        const available = change.method_kind === 'lens' ? lensTargets.size : recipeTargets.size;
        if (available && change.matched_ids.length === 0) result.errors.push(`${change.item_id}: 已有 Wiki 非空，必须绑定至少一个最接近候选，不能只写比较摘要`);
        for (const id of change.matched_ids) if (!targets.has(id)) result.errors.push(`${change.item_id}: matched_ids 含不存在的 ${change.method_kind} ${id}`);
        if (change.target_id && !targets.has(change.target_id)) result.errors.push(`${change.item_id}: target_id 不存在于当前 Wiki：${change.target_id}`);
        if (change.target_id && !change.matched_ids.includes(change.target_id)) result.errors.push(`${change.item_id}: target_id 必须同时列入 matched_ids`);
        if (change.method_kind === 'lens' && change.target_id && lensTargets.get(change.target_id) !== change.target_module_id) result.errors.push(`${change.item_id}: target_module_id 与目标 Lens 实际 Module 不一致`);
        if (!change.matched_ids.length && (change.confidence > 0.7 || !change.needs_human_review)) result.errors.push(`${change.item_id}: 无核验候选时置信度不得高于 0.7，且必须进入人工复核`);
      }
    }
  }
}
result.valid = result.errors.length === 0;
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.valid ? 0 : 1);
