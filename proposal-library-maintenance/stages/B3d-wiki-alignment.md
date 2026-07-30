# B3d：与已有 Wiki 深度对照（仅增补路线）

## 本阶段在全流程中的作用

B3d 不再提取或改写新方法。它把 B3c 已冻结的 Lens/Recipe 与活动 Wiki 做深度比较，为 B4 给出可审阅的处置建议。已有 Wiki 到这里才首次披露，防止旧库过早锚定新材料。

## 任务组织

这是语义判断任务，不是按 ID 批量匹配。模型以同一 Module 下 **2–5 个冻结 Lens 为一组**工作：

1. 先读完这一组冻结对象，理解它们彼此的边界；
2. 为每个对象从索引中找出 2–3 个最可能的既有候选；
3. 打开候选完整对象，逐项比较；
4. 先完成组内所有判断，再汇总为 change records。

对象不足 2 个时允许单独处理；对象较多时拆成多组。禁止为每个对象机械选择同 Module 的第一个 Lens，也禁止先写结论再补比较理由。

## 比较顺序

1. 先根据解决的问题、输入输出和关键操作看 `wiki-index.json`，形成 2–3 个候选短名单；标题和 Module 只作线索。
2. 再打开短名单内候选的完整方法对象；名称相似或同属一个 Module 不能直接决定。
3. 对每个冻结 Lens 填完五维比较：解决问题、操作链、输入输出、适用/跳过边界、页面论证结构。五项都必须有具体差异或“相同”的依据，不能用一句总评代替。
4. Recipe 还要比较成员 Lens、步骤顺序和依赖关系；跨 Module 不是拒绝理由。
5. 对每个冻结对象给出唯一建议：`new`、`merge`、`variant`、`revision`、`add_source`、`reroute` 或 `no_change`。

每项都必须绑定最接近的可核验候选：

- 不只搜索当前主 Module；根据问题、输入输出和操作链检查相邻或可能误分类的 Module。
- Wiki 中存在同类对象时，在 `matched_ids` 中列出至少一个最接近候选，即使最终建议仍是 `new`。
- 比较正文中提到的既有方法必须出现在 `matched_ids`，`target_id` 也必须属于 `matched_ids`。
- 没有绑定候选时不得给出高置信度结论，且必须标记人工复核。

只有在跨相关 Module 检索后仍没有可比对象时，`matched_ids` 才能为空。此时理由必须写明检索过哪些问题词、输入输出和 Module，不能把“没有找到”当作默认的 `new`。

## 决策边界

- `merge`：核心问题和操作链相同，可形成一个更完整方法，必须明确目标 Lens。
- `variant`：核心方法相同，但条件或关键分支稳定不同，必须明确母 Lens。
- `revision`：新证据证明已有方法正文或页面结构需要改变。
- `add_source`：方法没有语义变化，只增加来源。
- `reroute`：方法成立，但主 Module 判断错误。
- `no_change`：已有库已完整覆盖，且没有新边界、结构或证据价值。
- `new`：存在无法被已有方法吸收的稳定语义差异。

不得为了减少新增而硬合并，也不得让旧 Wiki 的措辞反向改写 B3c 冻结发现。接近但不确定时，保留差异并设置 `needs_human_review: true`。

## 脚本和输出

```bash
node scripts/build-wiki-snapshot.mjs \
  --wiki-dir <活动 Wiki> \
  --output <运行目录>/B3d/wiki-snapshot.json

node scripts/validate-wiki-alignments.mjs \
  --input <运行目录>/B3d/wiki-alignment.json \
  --curation <运行目录>/B3c/library-curation.json \
  --snapshot <运行目录>/B3d/wiki-snapshot.json
```

模型任务包必须包含 `library-curation.json`、完整 `wiki-snapshot.json`、本文件全文和 `wiki-change-candidate.schema.json`。任务 Prompt 必须直接写出本轮对象 ID、同组对象、候选短名单要求和五维比较要求，不能只丢给模型一组文件路径。输出 `wiki-change-candidate/2.0.0`；每个冻结 Lens/Recipe 必须恰有一条 change。Validator 会核验 `matched_ids`、`target_id` 和目标 Module 都真实存在于 snapshot。
