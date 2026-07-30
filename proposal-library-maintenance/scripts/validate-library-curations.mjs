#!/usr/bin/env node
import { resolve } from 'node:path';
import { validateFile, parseArtifact } from './lib/contract-validation.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
const input = args['--input'];
if (!input) process.exit(2);
const result = validateFile(resolve(input), resolve(import.meta.dirname, '../contracts/library-curation.schema.json'));
if (result.valid) {
  const record = parseArtifact(resolve(input)).records[0];
  const lensIds = new Set();
  for (const module of record.modules) for (const lens of module.lenses) {
    if (lensIds.has(lens.lens_id)) result.errors.push(`重复 lens_id：${lens.lens_id}`);
    lensIds.add(lens.lens_id);
    lens.page_structure.forEach((page, index) => {
      if (page.page !== index + 1) result.errors.push(`${lens.lens_id}: page_structure.page 必须从 1 连续递增`);
    });
  }
  for (const recipe of record.recipes) {
    const members = new Set([...recipe.required_lens_ids, ...recipe.optional_lens_ids]);
    for (const id of members) if (!lensIds.has(id)) result.errors.push(`${recipe.recipe_id}: 引用了未冻结 Lens ${id}`);
    recipe.steps.forEach((step, index) => {
      if (step.step_index !== index + 1) result.errors.push(`${recipe.recipe_id}: step_index 必须连续`);
      if (!members.has(step.lens_id)) result.errors.push(`${recipe.recipe_id}: step 引用了非成员 Lens ${step.lens_id}`);
    });
  }
  if (args['--extractions']) {
    const extractionRecords = parseArtifact(resolve(args['--extractions'])).records;
    const resultMap = new Map(extractionRecords.flatMap(item => item.results.map(result => [result.result_id, { result, source_unit_id: item.source_unit_id }])));
    const expected = new Set(resultMap.keys());
    const destinations = new Map();
    for (const lens of record.modules.flatMap(module => module.lenses)) {
      for (const id of lens.source_result_ids) {
        if (!destinations.has(id)) destinations.set(id, []);
        destinations.get(id).push(`lens:${lens.lens_id}`);
      }
    }
    for (const terminal of record.terminal_results) {
      for (const id of terminal.source_result_ids) {
        if (!destinations.has(id)) destinations.set(id, []);
        destinations.get(id).push(`terminal:${terminal.terminal_state}`);
      }
    }
    const used = new Set(destinations.keys());
    for (const id of expected) if (!used.has(id)) result.errors.push(`B3b 结果没有进入冻结 Lens 或终态：${id}`);
    for (const id of used) if (!expected.has(id)) result.errors.push(`B3c 引用了未知 B3b result：${id}`);
    for (const [id, uses] of destinations) if (uses.length !== 1) result.errors.push(`${id}: 必须恰好进入一个冻结 Lens 或一个诚实终态，当前为 ${uses.join(', ')}`);
    for (const lens of record.modules.flatMap(module => module.lenses)) {
      const sources = lens.source_result_ids.map(id => resultMap.get(id)).filter(Boolean);
      const expectedUnits = new Set(sources.map(source => source.source_unit_id));
      const expectedPages = new Set(sources.flatMap(source => source.result.source_page_ids));
      for (const id of expectedUnits) if (!lens.source_unit_ids.includes(id)) result.errors.push(`${lens.lens_id}: 缺少来源 unit ${id}`);
      for (const id of lens.source_unit_ids) if (!expectedUnits.has(id)) result.errors.push(`${lens.lens_id}: 含非来源 unit ${id}`);
      for (const id of expectedPages) if (!lens.source_page_ids.includes(id)) result.errors.push(`${lens.lens_id}: 缺少来源 page ${id}`);
      for (const id of lens.source_page_ids) if (!expectedPages.has(id)) result.errors.push(`${lens.lens_id}: 含非来源 page ${id}`);
    }
  }
  if (args['--recipes']) {
    const discoveryRecords = parseArtifact(resolve(args['--recipes'])).records;
    const recipeMap = new Map(discoveryRecords.flatMap(item => item.recipes.map(recipe => [recipe.recipe_id, recipe])));
    const expected = new Set(recipeMap.keys());
    const used = new Set([...record.recipes.flatMap(recipe => recipe.source_recipe_ids), ...record.rejected_recipes.flatMap(item => item.source_recipe_ids)]);
    for (const id of expected) if (!used.has(id)) result.errors.push(`B3a Recipe 没有进入冻结 Recipe 或拒绝记录：${id}`);
    for (const id of used) if (!expected.has(id)) result.errors.push(`B3c 引用了未知 B3a Recipe：${id}`);
    for (const recipe of record.recipes) {
      const expectedUnits = new Set(recipe.source_recipe_ids.flatMap(id => recipeMap.get(id)?.source_unit_ids || []));
      for (const id of expectedUnits) if (!recipe.source_unit_ids.includes(id)) result.errors.push(`${recipe.recipe_id}: 缺少来源 unit ${id}`);
      for (const id of recipe.source_unit_ids) if (!expectedUnits.has(id)) result.errors.push(`${recipe.recipe_id}: 含非来源 unit ${id}`);
    }
  }
}
result.valid = result.errors.length === 0;
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.valid ? 0 : 1);
