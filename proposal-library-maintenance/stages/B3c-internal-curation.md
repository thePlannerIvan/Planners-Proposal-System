# B3c：本轮内部归并、Recipe 映射与冻结

## 本阶段在全流程中的作用

B3c 只处理本轮新材料，且保持 Wiki-blind。它把 B3b 的候选从“逐单元发现”整理成完整、可审阅、可安装的冻结库对象。这里必须输出 Lens/Recipe 全文，不能只列冻结 ID；B4 和 B5 都复用同一对象，避免阶段间重新生成。

## 模型任务

1. 横向比较本轮所有 Lens 的问题、操作链、输入输出、边界和页面结构。
2. 相同核心方法合并并保留所有来源；一个候选混合多个独立问题时拆分。
3. 核心方法相同、仅适用条件或操作分支不同，才定义为 Variant；名字相似不等于相同。
4. 把 B3a Recipe 的方法角色映射到冻结 Lens ID；修正伪依赖，删除无法成立的 Recipe。
5. 为每个 Lens 确认唯一主 Module；必要时建立新的 Module 定义。
6. 为 case-only、证据不足、无 Lens、弱抽象或重复淘汰项保留终态理由。

多个单元单独看只是 `case_only`，但横向比较后出现稳定重复结构时，可以在本阶段将它们共同提升为一个 Lens。此时必须：

- 说明重复模式为何构成可执行方法，而不只是相似版式；
- 汇总全部来源 result、unit 和 page；
- 不再把同一 result 留在 `terminal_results`。每个 B3b result 最终只能进入一个冻结 Lens，或进入一个诚实终态。

## 冻结前自检

- 每个 Lens 只解决一个稳定问题，操作可执行，不是主题标签。
- 所有品牌/品类/slogan/具体场景/活动/数字等项目残留已清零。
- 页面结构描述论证推进，不是操作步骤复述。
- 页面结构覆盖全部关键操作和输出；`page_structure_check` 不得有未覆盖项。
- 来源 result、unit 和 page 均可回查。
- Recipe 的每一步引用已冻结 Lens，且输入输出依赖真实。
- 允许 modules、recipes 为空；禁止为了数量保留空壳。

## 输出和命令

输出唯一的 `library-curation/2.0.0` JSON 文件，内含完整 `modules[].lenses[]`、跨 Module `recipes[]` 与终态记录。

```bash
node scripts/validate-library-curations.mjs \
  --input <运行目录>/B3c/library-curation.json \
  --extractions <运行目录>/B3b/lens-extractions.jsonl \
  --recipes <运行目录>/B3a/recipe-discoveries.jsonl
```

Validator 会拒绝同一 result 同时进入 Lens 与 terminal state，或进入多个 Lens。增补路线验证通过后才允许在 B3d 首次读取已有 Wiki；独立新建路线直接把这份冻结对象交给 B4。
