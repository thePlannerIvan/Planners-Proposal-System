#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { validateFile } from './lib/contract-validation.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
for (const key of ['--curation', '--route', '--output']) if (!args[key]) throw new Error(`Missing ${key}`);
if (!['isolated_bootstrap', 'upgrade_existing'].includes(args['--route'])) throw new Error('route 无效');
if (args['--route'] === 'upgrade_existing' && (!args['--alignment'] || !args['--wiki-dir'])) throw new Error('增补路线必须提供 --alignment 和 --wiki-dir');
const hash = value => createHash('sha256').update(value).digest('hex');
const curationPath = resolve(args['--curation']);
const curationRaw = readFileSync(curationPath, 'utf8');
const curation = JSON.parse(curationRaw);
const alignment = args['--alignment'] ? JSON.parse(readFileSync(resolve(args['--alignment']), 'utf8')) : null;
if (alignment && alignment.curation_sha256 !== hash(curationRaw)) throw new Error('B3d alignment 未绑定当前 B3c 冻结对象');
const alignmentBySource = new Map((alignment?.changes || []).map(item => [item.source_id, item]));
const mergeTargets = [];
const moduleTargets = [];
const recipeTargets = [];
if (args['--wiki-dir']) {
  const wikiDir = resolve(args['--wiki-dir']);
  const modulesDir = join(wikiDir, 'modules');
  for (const name of readdirSync(modulesDir).filter(name => name.endsWith('.json')).sort()) {
    const module = JSON.parse(readFileSync(join(modulesDir, name), 'utf8'));
    moduleTargets.push({ module_id: module.module_id, label_zh: module.title });
    for (const lens of module.lens_catalog || []) mergeTargets.push({
      module_id: module.module_id,
      module_title_zh: module.title,
      target_id: lens.lens_id,
      label_zh: `${module.title} / ${lens.name}`,
      question_zh: lens.question || '',
      target: lens
    });
  }
  try {
    const catalog = JSON.parse(readFileSync(join(wikiDir, 'wiki-recipes.json'), 'utf8'));
    for (const recipe of catalog.recipes || []) recipeTargets.push({
      module_id: null,
      target_id: recipe.recipe_id,
      label_zh: recipe.name,
      target: recipe
    });
  } catch {}
}
const items = [];
for (const module of curation.modules) {
  for (const lens of module.lenses) {
    const align = alignmentBySource.get(lens.lens_id);
    const matchedIds = new Set(align?.matched_ids || []);
    const orderedTargets = [...mergeTargets].sort((left, right) =>
      Number(matchedIds.has(right.target_id)) - Number(matchedIds.has(left.target_id))
      || left.label_zh.localeCompare(right.label_zh, 'zh-CN'));
    items.push({
      item_id: `review_${hash(`lens:${lens.lens_id}`).slice(0, 24)}`,
      method_kind: 'lens',
      source_id: lens.lens_id,
      source_module_id: module.module_id,
      module_meta: { title_zh: module.title_zh, stable_decision_zh: module.stable_decision_zh, unified_preconditions_zh: module.unified_preconditions_zh },
      proposal: lens,
      recommended_action: align?.recommended_action || null,
      allowed_decisions: args['--route'] === 'isolated_bootstrap'
        ? ['approve', 'revise', 'reject', 'defer']
        : ['new', 'merge', 'variant', 'revision', 'add_source', 'reroute', 'no_change', 'reject', 'defer'],
      merge_targets: args['--route'] === 'upgrade_existing' ? orderedTargets : [],
      module_targets: args['--route'] === 'upgrade_existing' ? moduleTargets : [],
      comparison: align || null
    });
  }
}
for (const recipe of curation.recipes) {
  const align = alignmentBySource.get(recipe.recipe_id);
  items.push({
    item_id: `review_${hash(`recipe:${recipe.recipe_id}`).slice(0, 24)}`,
    method_kind: 'recipe',
    source_id: recipe.recipe_id,
    source_module_id: null,
    module_meta: null,
    proposal: recipe,
    recommended_action: align?.recommended_action || null,
      allowed_decisions: args['--route'] === 'isolated_bootstrap'
        ? ['approve', 'revise', 'reject', 'defer']
        : ['new', 'revision', 'add_source', 'no_change', 'reject', 'defer'],
    merge_targets: args['--route'] === 'upgrade_existing' ? recipeTargets : [],
    module_targets: [],
    comparison: align || null
  });
}
if (!items.length) throw new Error('没有可进入 B4 的 Lens 或 Recipe；应记录零结果并结束，而不是打开空审阅页');
const output = resolve(args['--output']);
mkdirSync(dirname(output), { recursive: true });
const bundle = { contract_version: '1.0.0', route: args['--route'], source_sha256: hash(curationRaw), items };
writeFileSync(output, `${JSON.stringify(bundle, null, 2)}\n`);
const check = validateFile(output, resolve(import.meta.dirname, '../contracts/review-bundle.schema.json'));
if (!check.valid) throw new Error(`review-bundle Contract 失败：${check.errors.join('; ')}`);
process.stdout.write(`${JSON.stringify({ valid: true, items: items.length, route: bundle.route, output })}\n`);
