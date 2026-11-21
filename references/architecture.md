# Proposal 的职责与接口

日常执行以 [SKILL.md](../SKILL.md) 为准；本文件仅记录模块间职责与接口边界。

| 所属方 | 职责与接口 |
|---|---|
| `planners-proposal` | 理解项目、推动高摩擦研讨、撰写 `.planners/storyline.md`（每页一句主张 + 支撑 + 轻量出处）、维护 `.planners/project-memory.md` 与轻量 `source-index.json`（`2.1.0`） |
| `sparkling` / `storytelling` / `slide-copy` | 分别承接业务卡点研讨、叙事推进节奏、单句主张与标题链打磨 |
| `planners-method-wiki` | 通过 Karpathy Markdown Wiki（`index.md` / `query-wiki.mjs` / `lenses/*.md`）提供可复用分析框架与页面表达启发 |
| `planners-source-index` | 定义并校验 `source-index/2.1.0`；Proposal 阶段只登记主要来源、覆盖与 `provenance` / `blind_spots`，不强制逐份拆建细粒度 `audit_companion` |
| `planners-review-core` | 唯一文字工作台与 `planners-doc/2` 契约实现（`doc-surface.mjs` / `doc-command.mjs` / `doc-workbench.mjs` / `doc-inbox.mjs`），包含 `task.diff`、自动保存、版本历史与待核对冲突解决 |
| `planners-fact-check` | Proposal 阶段仅在核心结论或关键数值改写时按需局部复核；全面独立事实审计由 `planners-bypage` 负责 |
| `planners-bypage` | 接收 `<Project>/.planners/` 下的 `storyline.md`、`project-memory.md` 与 `source-index.json`，扩写为可编程 PPT 逐页稿并完成全面核查 |

## 架构约束

- 新项目主线只有一个文件：`.planners/storyline.md`，结构归属 `planners-review-core/contracts/planners-doc.md`，提案语义规则归属 [Storyline 格式](../contracts/storyline.md) 与 `scripts/validate-storyline-doc.mjs`。
- 旧 `.proposal-work/page-architecture.json` 及相关 JSON 审阅流已退役，工作台仅作只读展示。
