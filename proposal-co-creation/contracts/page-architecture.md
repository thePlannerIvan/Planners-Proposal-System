# Storyline 与页面架构交接格式

`page-architecture/2.0.0` 是 Co-creation 交给 By-page Copy 的唯一正式结构边界。它在方向成熟后生成，把 Storyline 的认知推进展开为可写作的页面判断，但不写最终文案。

## 核心语义

- Storyline 是客户认知改变的路径，不是最终页数。
- 一个认知节点可以用一页完成，也可以因为证明负担较重而展开为数页。
- 每页只证明一个主要判断。
- `content_blocks`描述为了证明这个判断，页面上需要出现哪些完整内容；它不是几个短句的字数配额。
- 内容块可以要求段落、数据表、图表、图片、比较、矩阵、模型、路线图、案例或其他合适形式。
- `chart_brief`和`layout_direction`不是必填任务。只有结构本身依赖某种不可替代关系时才填写。
- 不存在 `asset_resolution`。

## 结构

- `storyline_thesis`：整份方案要建立的核心说服主线。
- `sections[]`：认知阶段，不是惯常目录。
- `pages[].section_id`：页面属于哪个认知阶段。
- `pages[].page_job`：本页为什么必须存在。
- `pages[].title_intent`：要表达的观点式标题。
- `pages[].claim`：本页唯一主要判断。
- `pages[].content_blocks`：证明判断所需的完整内容构成。
- `pages[].evidence_needs`：By-page 回到原始资料时需要寻找什么。
- `pages[].transition`：本页完成后自然产生的下一个问题。

## 完成标准

1. 页码从 1 连续递增，Section 引用有效。
2. 每页只有一个主要判断，但内容足以完成该判断。
3. 页面数量由证明需要决定，不由 Storyline 句子数量决定。
4. 页面主张没有超过已经锁定的方向和材料强度。
5. Brief 的必要交付均有落点，重复、填充和越界页已移除。
6. 用户已在自动打开的结构审阅页面看过整条 Storyline 与全部页面。

验证：

```bash
node proposal-co-creation/scripts/validate-page-architectures.mjs \
  .proposal-work/page-architecture.json
```
