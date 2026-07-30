export function validateWikiGraph(modules, recipeCatalog, index = null) {
  const errors = [];
  const moduleIds = new Set();
  const lensIds = new Set();

  for (const module of modules) {
    if (moduleIds.has(module.module_id)) errors.push(`重复 Module ID：${module.module_id}`);
    moduleIds.add(module.module_id);
    for (const lens of module.lens_catalog || []) {
      if (lensIds.has(lens.lens_id)) errors.push(`重复 Lens ID：${lens.lens_id}`);
      lensIds.add(lens.lens_id);
    }
  }

  const recipeIds = new Set();
  for (const recipe of recipeCatalog?.recipes || []) {
    if (recipeIds.has(recipe.recipe_id)) errors.push(`重复 Recipe ID：${recipe.recipe_id}`);
    recipeIds.add(recipe.recipe_id);
    const members = new Set([...(recipe.required_lens_ids || []), ...(recipe.optional_lens_ids || [])]);
    for (const lensId of members) {
      if (!lensIds.has(lensId)) errors.push(`${recipe.recipe_id}: 引用了不存在的 Lens ${lensId}`);
    }
    for (const step of recipe.steps || []) {
      if (!members.has(step.lens_id)) errors.push(`${recipe.recipe_id}: step ${step.step_index} 引用了非成员 Lens ${step.lens_id}`);
      if (!lensIds.has(step.lens_id)) errors.push(`${recipe.recipe_id}: step ${step.step_index} 引用了不存在的 Lens ${step.lens_id}`);
    }
  }

  if (index) {
    const indexedModules = new Map((index.modules || []).map(module => [module.module_id, module]));
    for (const module of modules) {
      const indexed = indexedModules.get(module.module_id);
      if (!indexed) {
        errors.push(`wiki-index 缺少 Module ${module.module_id}`);
        continue;
      }
      const actualLensIds = new Set((module.lens_catalog || []).map(lens => lens.lens_id));
      const indexedLensIds = new Set((indexed.lenses || []).map(lens => lens.lens_id));
      for (const lensId of actualLensIds) if (!indexedLensIds.has(lensId)) errors.push(`wiki-index 缺少 Lens ${lensId}`);
      for (const lensId of indexedLensIds) if (!actualLensIds.has(lensId)) errors.push(`wiki-index 含不存在的 Lens ${lensId}`);
    }
    for (const moduleId of indexedModules.keys()) if (!moduleIds.has(moduleId)) errors.push(`wiki-index 含不存在的 Module ${moduleId}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      modules: moduleIds.size,
      lenses: lensIds.size,
      recipes: recipeIds.size
    }
  };
}
