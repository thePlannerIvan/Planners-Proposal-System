#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { validateFile } from './lib/contract-validation.mjs';
import { validateWikiGraph } from './lib/wiki-integrity.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
for (const key of ['--bundle', '--feedback', '--wiki-dir', '--run-state']) if (!args[key]) {
  process.stderr.write('用法：install-wiki-module.mjs --bundle <review-bundle.json> --feedback <review-feedback.json> --wiki-dir <Wiki> --run-state <run-state.json>\n');
  process.exit(2);
}
const hash = value => createHash('sha256').update(value).digest('hex');
const load = path => JSON.parse(readFileSync(resolve(path), 'utf8'));
const unique = values => [...new Set(values.filter(Boolean))];
const bundle = load(args['--bundle']);
const feedback = load(args['--feedback']);
const state = load(args['--run-state']);
const feedbackCheck = validateFile(resolve(args['--feedback']), resolve(import.meta.dirname, '../contracts/review-feedback.schema.json'));
if (!feedbackCheck.valid) throw new Error(`B4 feedback Contract 失败：${feedbackCheck.errors.join('; ')}`);
const bundleCheck = validateFile(resolve(args['--bundle']), resolve(import.meta.dirname, '../contracts/review-bundle.schema.json'));
if (!bundleCheck.valid) throw new Error(`B4 bundle Contract 失败：${bundleCheck.errors.join('; ')}`);
if (state.contract_version !== '4.0.0' || state.current_stage !== 'B5' || state.installation_permitted !== true || state.stages?.B4?.status !== 'passed') throw new Error('B5 需要调度器验证过 B4 且 installation_permitted=true 的 v4 run-state');
const bundleRaw = readFileSync(resolve(args['--bundle']), 'utf8');
if (feedback.review_bundle_sha256 !== hash(bundleRaw) || feedback.route !== bundle.route) throw new Error('反馈未绑定当前审阅包');
const decisions = new Map(feedback.decisions.map(item => [item.item_id, item]));
if (decisions.size !== bundle.items.length || bundle.items.some(item => !decisions.has(item.item_id))) throw new Error('反馈没有完整覆盖审阅包');

const wikiDir = resolve(args['--wiki-dir']);
const modulesDir = join(wikiDir, 'modules');
mkdirSync(modulesDir, { recursive: true });
const modules = new Map();
for (const file of readdirSync(modulesDir).filter(name => name.endsWith('.json'))) {
  const module = JSON.parse(readFileSync(join(modulesDir, file), 'utf8'));
  modules.set(module.module_id, module);
}
const recipePath = join(wikiDir, 'wiki-recipes.json');
const recipeCatalog = existsSync(recipePath)
  ? JSON.parse(readFileSync(recipePath, 'utf8'))
  : { contract_version: '1.0.0', catalog_version: '0.0.0', updated_at: new Date(0).toISOString(), recipes: [] };

const sourceIds = proposal => unique((proposal.source_unit_ids || []).map(id => `mi_${hash(id).slice(0, 24)}`));
function toWikiPage(page) {
  return {
    page: page.page,
    title: page.title_zh,
    content: `${page.purpose_zh}\n回答：${page.question_zh}\n证据：${page.evidence_needed_zh.join('；')}`,
    purpose: page.purpose_zh,
    question: page.question_zh,
    required_evidence: page.evidence_needed_zh,
    information_relationship: page.information_relationship,
    connects_from: page.from_previous_zh,
    connects_to: page.to_next_zh,
    common_misuse: page.misuse_warning_zh
  };
}
function toWikiLens(proposal, forcedId = null) {
  return {
    lens_id: forcedId || proposal.lens_id,
    name: proposal.name_zh,
    aliases: proposal.aliases_zh || [],
    question: proposal.question_zh,
    use_conditions: proposal.use_conditions_zh,
    skip_conditions: proposal.skip_conditions_zh,
    required_inputs: proposal.required_inputs_zh,
    analysis_operations: proposal.operations_zh,
    page_structure: proposal.page_structure.map(toWikiPage),
    output_types: proposal.output_types_zh,
    failure_modes: proposal.failure_modes_zh,
    boundaries: proposal.boundaries_zh || [],
    variants: [],
    source_module_instance_ids: sourceIds(proposal),
    abstraction_self_check: { passed: true, checks: {}, issues: proposal.abstraction_check?.issues_zh || [], needs_human_review: false, abstraction_difficulty: 'medium' }
  };
}
function toWikiRecipe(proposal, forcedId = null) {
  return {
    recipe_id: forcedId || proposal.recipe_id,
    name: proposal.name_zh,
    purpose: proposal.purpose_zh,
    required_lens_ids: proposal.required_lens_ids,
    optional_lens_ids: proposal.optional_lens_ids,
    steps: proposal.steps.map(step => ({ step_index: step.step_index, lens_id: step.lens_id, role: step.role_zh, input: step.input_zh, output: step.output_zh, dependency: step.dependency_zh })),
    use_conditions: proposal.use_conditions_zh,
    skip_conditions: proposal.skip_conditions_zh,
    source_module_instance_ids: sourceIds(proposal)
  };
}
function ensureModule(moduleId, meta) {
  if (modules.has(moduleId)) return modules.get(moduleId);
  if (!meta) throw new Error(`新 Module ${moduleId} 缺少 B3c module_meta`);
  const module = {
    contract_version: '1.0.0',
    wiki_module_id: `wm_${hash(moduleId).slice(0, 24)}`,
    module_id: moduleId,
    title: meta.title_zh,
    stable_decision: meta.stable_decision_zh,
    unified_preconditions: meta.unified_preconditions_zh,
    lens_catalog: [],
    recipes: [],
    page_expression_options: [],
    source_module_instance_ids: [],
    wiki_version: '0.0.0',
    status: 'active',
    approval: { human_approved: true, reviewer_note: '', approved_at: feedback.saved_at },
    deletion: { deleted: false, reason: null, replaced_by: null },
    created_from_hash: hash(bundleRaw)
  };
  modules.set(moduleId, module);
  return module;
}
const touchedModules = new Set();
let recipesTouched = false;
const lensResolution = new Map();
for (const item of bundle.items.filter(item => item.method_kind === 'lens')) {
  const review = decisions.get(item.item_id);
  const decision = review.decision;
  if (['reject', 'defer'].includes(decision)) continue;
  if (decision === 'no_change') {
    if (!review.target_id) throw new Error(`${item.item_id}: no_change 必须明确由哪个既有 Lens 覆盖`);
    lensResolution.set(item.source_id, review.target_id);
    continue;
  }
  const proposal = review.edited_proposal || item.proposal;
  let moduleId = decision === 'reroute' ? review.target_module_id : (review.target_module_id || item.source_module_id);
  if (!moduleId) throw new Error(`${item.item_id}: 缺少目标 Module`);
  const module = ensureModule(moduleId, moduleId === item.source_module_id ? item.module_meta : { title_zh: moduleId, stable_decision_zh: '经 B4 明确改路由加入该 Module。', unified_preconditions_zh: [] });
  const targetIndex = review.target_id ? module.lens_catalog.findIndex(lens => lens.lens_id === review.target_id) : -1;
  if (decision === 'add_source') {
    if (targetIndex < 0) throw new Error(`${item.item_id}: Lens 目标不存在`);
    module.lens_catalog[targetIndex].source_module_instance_ids = unique([...module.lens_catalog[targetIndex].source_module_instance_ids, ...sourceIds(proposal)]);
  } else if (decision === 'variant') {
    if (targetIndex < 0) throw new Error(`${item.item_id}: Variant 目标不存在`);
    const variantId = `variant_${hash(`${review.target_id}:${proposal.lens_id}`).slice(0, 24)}`;
    module.lens_catalog[targetIndex].variants.push({ variant_id: variantId, name: proposal.name_zh, use_conditions: proposal.use_conditions_zh, analysis_operations: proposal.operations_zh, source_module_instance_ids: sourceIds(proposal) });
  } else if (['merge', 'revision'].includes(decision)) {
    if (targetIndex < 0) throw new Error(`${item.item_id}: 合并/修订目标不存在`);
    if (!review.edited_proposal) throw new Error(`${item.item_id}: ${decision} 必须提交人工确认后的完整最终 Lens`);
    const replacement = toWikiLens(proposal, review.target_id);
    replacement.source_module_instance_ids = unique([...module.lens_catalog[targetIndex].source_module_instance_ids, ...replacement.source_module_instance_ids]);
    replacement.variants = module.lens_catalog[targetIndex].variants || [];
    module.lens_catalog[targetIndex] = replacement;
  } else if (['approve', 'revise', 'new', 'reroute'].includes(decision)) {
    if (module.lens_catalog.some(lens => lens.lens_id === proposal.lens_id)) throw new Error(`${item.item_id}: Lens ID 已存在，必须选择合并、变体或修订`);
    module.lens_catalog.push(toWikiLens(proposal));
  } else throw new Error(`${item.item_id}: Lens 不支持决定 ${decision}`);
  module.source_module_instance_ids = unique(module.lens_catalog.flatMap(lens => [ ...lens.source_module_instance_ids, ...(lens.variants || []).flatMap(variant => variant.source_module_instance_ids) ]));
  touchedModules.add(moduleId);
  lensResolution.set(item.source_id, ['merge', 'variant', 'revision', 'add_source'].includes(decision) ? review.target_id : proposal.lens_id);
}

function resolveRecipeProposal(proposal, itemId) {
  const resolveLensId = lensId => {
    const resolved = lensResolution.get(lensId);
    if (!resolved) throw new Error(`${itemId}: Recipe 依赖 ${lensId} 未获批准、被暂缓或被拒绝`);
    return resolved;
  };
  return {
    ...proposal,
    required_lens_ids: unique(proposal.required_lens_ids.map(resolveLensId)),
    optional_lens_ids: unique(proposal.optional_lens_ids.map(resolveLensId)),
    steps: proposal.steps.map(step => ({ ...step, lens_id: resolveLensId(step.lens_id) }))
  };
}

for (const item of bundle.items.filter(item => item.method_kind === 'recipe')) {
  const review = decisions.get(item.item_id);
  const decision = review.decision;
  if (['reject', 'defer', 'no_change'].includes(decision)) continue;
  const proposal = review.edited_proposal || item.proposal;
  const targetIndex = review.target_id ? recipeCatalog.recipes.findIndex(recipe => recipe.recipe_id === review.target_id) : -1;
  if (decision === 'add_source') {
    if (targetIndex < 0) throw new Error(`${item.item_id}: Recipe 目标不存在`);
    recipeCatalog.recipes[targetIndex].source_module_instance_ids = unique([...recipeCatalog.recipes[targetIndex].source_module_instance_ids, ...sourceIds(proposal)]);
  } else if (decision === 'revision') {
    if (targetIndex < 0) throw new Error(`${item.item_id}: Recipe 修订目标不存在`);
    if (!review.edited_proposal) throw new Error(`${item.item_id}: revision 必须提交人工确认后的完整最终 Recipe`);
    recipeCatalog.recipes[targetIndex] = toWikiRecipe(resolveRecipeProposal(proposal, item.item_id), review.target_id);
  } else if (['approve', 'revise', 'new'].includes(decision)) {
    const resolvedProposal = resolveRecipeProposal(proposal, item.item_id);
    if (recipeCatalog.recipes.some(recipe => recipe.recipe_id === resolvedProposal.recipe_id)) throw new Error(`${item.item_id}: Recipe ID 已存在，必须选择修订或补来源`);
    recipeCatalog.recipes.push(toWikiRecipe(resolvedProposal));
  } else throw new Error(`${item.item_id}: Recipe 不支持决定 ${decision}`);
  recipesTouched = true;
}

function bump(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return version === '0.0.0' ? '1.0.0' : `${major}.${minor}.${patch + 1}`;
}
for (const moduleId of touchedModules) {
  const module = modules.get(moduleId);
  module.wiki_version = bump(module.wiki_version);
  module.status = 'active';
  module.approval = { human_approved: true, reviewer_note: `B4：${feedback.reviewer}；${feedback.decisions.filter(item => !['reject', 'defer', 'no_change'].includes(item.decision)).length} 项获准执行`, approved_at: feedback.saved_at };
  const checkPath = join(wikiDir, `.validate-${moduleId}-${process.pid}.json`);
  writeFileSync(checkPath, `${JSON.stringify(module, null, 2)}\n`);
  const check = validateFile(checkPath, resolve(import.meta.dirname, '../contracts/wiki-module.schema.json'));
  unlinkSync(checkPath);
  if (!check.valid) throw new Error(`${moduleId} 未通过 wiki-module Contract：${check.errors.join('; ')}`);
}
if (recipesTouched) {
  recipeCatalog.catalog_version = bump(recipeCatalog.catalog_version);
  recipeCatalog.updated_at = feedback.saved_at;
  const recipeTemp = join(wikiDir, `.validate-recipes-${process.pid}.json`);
  writeFileSync(recipeTemp, `${JSON.stringify(recipeCatalog, null, 2)}\n`);
  const check = validateFile(recipeTemp, resolve(import.meta.dirname, '../contracts/wiki-recipe-catalog.schema.json'));
  unlinkSync(recipeTemp);
  if (!check.valid) throw new Error(`Recipe Catalog Contract 失败：${check.errors.join('; ')}`);
}
const graphCheck = validateWikiGraph([...modules.values()], recipeCatalog);
if (!graphCheck.valid) throw new Error(`安装后 Wiki 引用图不完整：${graphCheck.errors.join('; ')}`);

const timestamp = feedback.saved_at.replace(/[:.]/g, '-');
const writes = [];
for (const moduleId of touchedModules) {
  const target = join(modulesDir, `${moduleId}.json`);
  const previous = existsSync(target) ? readFileSync(target) : null;
  if (previous) {
    const old = JSON.parse(previous);
    const revision = join(wikiDir, 'revisions', moduleId, `${old.wiki_version}-${timestamp}.json`);
    writes.push({ path: revision, content: previous, exclusive: true });
  }
  writes.push({ path: target, content: Buffer.from(`${JSON.stringify(modules.get(moduleId), null, 2)}\n`) });
}
if (recipesTouched) {
  if (existsSync(recipePath)) writes.push({ path: join(wikiDir, 'revisions', 'recipes', `${recipeCatalog.catalog_version}-${timestamp}-previous.json`), content: readFileSync(recipePath), exclusive: true });
  writes.push({ path: recipePath, content: Buffer.from(`${JSON.stringify(recipeCatalog, null, 2)}\n`) });
}
const index = {
  index_version: '3.0.0',
  generated_at: feedback.saved_at,
  modules: [...modules.values()].sort((a, b) => a.module_id.localeCompare(b.module_id)).map(module => ({
    wiki_module_id: module.wiki_module_id,
    module_id: module.module_id,
    title: module.title,
    wiki_version: module.wiki_version,
    stable_decision: module.stable_decision,
    lenses: module.lens_catalog.map(lens => ({ lens_id: lens.lens_id, name: lens.name, question: lens.question, use_conditions: lens.use_conditions }))
  })),
  recipe_catalog: recipesTouched || existsSync(recipePath) ? 'wiki-recipes.json' : null
};
const indexedGraphCheck = validateWikiGraph([...modules.values()], recipeCatalog, index);
if (!indexedGraphCheck.valid) throw new Error(`安装后 Wiki 索引不完整：${indexedGraphCheck.errors.join('; ')}`);
writes.push({ path: join(wikiDir, 'wiki-index.json'), content: Buffer.from(`${JSON.stringify(index, null, 2)}\n`) });

const originals = new Map();
const completed = [];
try {
  for (const write of writes) {
    mkdirSync(dirname(write.path), { recursive: true });
    if (write.exclusive && existsSync(write.path)) throw new Error(`revision 已存在：${write.path}`);
    originals.set(write.path, existsSync(write.path) ? readFileSync(write.path) : null);
    const temp = `${write.path}.tmp-${process.pid}`;
    writeFileSync(temp, write.content, { flag: 'wx' });
    renameSync(temp, write.path);
    completed.push(write.path);
  }
} catch (error) {
  for (const path of completed.reverse()) {
    const original = originals.get(path);
    if (original) writeFileSync(path, original);
    else if (existsSync(path)) unlinkSync(path);
  }
  throw new Error(`安装失败并已回滚已覆盖文件：${error.message}`);
}
const reportPath = join(wikiDir, 'revisions', 'install-reports', `${timestamp}.json`);
mkdirSync(dirname(reportPath), { recursive: true });
const report = { contract_version: '1.0.0', installed_at: feedback.saved_at, reviewer: feedback.reviewer, touched_modules: [...touchedModules], recipes_touched: recipesTouched, decisions: feedback.decisions, integrity: indexedGraphCheck };
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (args['--report-output']) {
  const reportOutput = resolve(args['--report-output']);
  mkdirSync(dirname(reportOutput), { recursive: true });
  writeFileSync(reportOutput, `${JSON.stringify(report, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify({ valid: true, touched_modules: [...touchedModules], recipes_touched: recipesTouched, index: join(wikiDir, 'wiki-index.json'), report: reportPath })}\n`);
