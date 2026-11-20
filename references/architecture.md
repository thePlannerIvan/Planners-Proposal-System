# Proposal 的职责与接口

生产流程以 [SKILL.md](../SKILL.md) 为准；本文件用于维护接口，不增加工作步骤。

| 所属方 | 职责与接口 |
|---|---|
| Proposal | 理解项目、推进讨论、形成主线；维护同一 `.planners/` 下的 `storyline.md`、`project-memory.md` 与 `source-index.json` |
| sparkling / Method Wiki / storytelling / slide-copy | 研讨、专业知识与方法、认知推进、幻灯片表达；按各 Skill 指引调用 |
| planners-source-index | 定义并校验来源契约，Proposal 负责真实阅读与登记 |
| planners-review-core | 定义 `planners-doc/2` 文档结构与 `planners-doc-task/1` 块级任务；提供工作台、自动保存、版本管理、待核对与收件箱。唯一实现，不复制工作台 |
| planners-bypage | 接收 `storyline.md`、项目记忆与来源索引，发展完整内容；旧 JSON 转换器只保留给旧项目 |

## 当前规则与维护范围

- 新项目只有一份主线工作稿：`.planners/storyline.md`，按 `planners-review-core/contracts/planners-doc.md` 的结构写，按 [文档形态](../proposal-co-creation/contracts/storyline.md) 的提案规则写。
- 工作台入口是 `planners-review-core/scripts/doc-workbench.mjs`。用户操作是就地改块、拖块与页、查看或恢复版本、提交块级反馈；没有手动保存按钮。宿主差异只影响打开与唤醒，不改变自动保存行为。
- 提案自己的校验是 `proposal-co-creation/scripts/validate-storyline-doc.mjs`：结构复用公共校验器，只加「每页有主张、有支撑」两类规则，不另写解析器。
- 旧 `.proposal-work/page-architecture.json` 与 [旧 JSON 格式](../proposal-co-creation/contracts/page-architecture.md)、`validate-page-architectures.mjs`、`start-page-review.mjs`、`review-inbox.mjs` 只服务已有项目和兼容测试，不再是新项目入口，工作台只读打开。

## 测试分工

- `evals/co-creation/storyline-doc.mjs`：模板与真实样例过校验、删支撑/删主张被拒、工作台按块读出。默认工作台的格式判据走这里。
- `evals/co-creation/storyline.mjs`、`co-creation/run.mjs`、`co-creation/edits.mjs`、`co-creation/workbench-ui.mjs`、`workflow/run.mjs`：旧 JSON 主稿的兼容用例。它们继续通过，不定义新项目的写作形态。

根入口负责内容判据；[文档形态](../proposal-co-creation/contracts/storyline.md) 负责怎么写、怎么校验；[工作台操作](workbench.md) 负责启动、任务处理与兼容说明。历史记录不参与日常生产。
