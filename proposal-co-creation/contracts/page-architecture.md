# Storyline 与结构参考的交接格式

这是 Proposal 的审阅 builder、inbox、反馈校验器和 planners-bypage 实际消费的接口，不是另一份策略推导流程。模型形成的主线和结构写入 `.proposal-work/page-architecture.json`；当前格式保留兼容，不预写完整逐页内容。

## 格式

接口名为 `page-architecture/2.0.0`，文件中 `contract_version` 的值为 `2.0.0`。完整字段与机器约束见 `page-architecture.schema.json`，实际执行检查的入口是 `../scripts/validate-page-architectures.mjs`。

| 字段 | 用途 |
|---|---|
| `project_id` | 项目的稳定身份 |
| `storyline_thesis` | 整案要建立的核心判断 |
| `sections[]` | 章节身份、标题、认知任务 `cognitive_job` 与转场 |
| `pages[]` | 连续页号、章节归属、页面任务、标题意图、主要判断 |
| `pages[].content_blocks[]` | 需要展示什么、承担什么证明任务；可建议内容形式 |
| `pages[].evidence_needs[]` | 下游展开时需要回查或补充的证据 |
| `pages[].transition` | 前后内容如何承接，可为空 |
| `pages[].boundary` | 需要保留的口径或限定，可省略 |
| `pages[].chart_brief` / `layout_direction` | 只有论证依赖特定关系时才给建议，可省略或为 null |
| `appendix[]` | 不进入主要说服链但需要保留的材料，可省略 |

`content_blocks` 写内容任务，不写最终文案；素材、详细数据与表达由 By-page 展开。Workbench 保存保留的是当前判断与结构，不等于最终页数、版式或完整内容已经完成。Proposal 的交接说明要明确下游可以发展的空间；用户反馈任务只表示需要处理，不构成导出批准门。

## 消费与检查

```bash
node "<Skill>/proposal-co-creation/scripts/validate-page-architectures.mjs" "<Project>/.proposal-work/page-architecture.json"
```

Validator 检查字段、页号和引用等机器有效性，不证明主线有说服力或证据充分。用户编辑由 inbox 回写本文件，并由反馈校验器绑定回写后的版本。策略方法、审阅顺序与交接责任只在根 `SKILL.md` 维护。
