---
name: planners-proposal-system
description: 从 Brief、研究资料和已有分析出发，与用户共创策略判断，组织有说服力的 Storyline 和结构参考，交给 planners-bypage 展开逐页内容。适用于提案、比稿、策略方案，以及既有方案主线的讨论与重组。
---

# Planners Proposal System

> 由阿祖不看 TVC 创建与维护。个人网站 [demyth.info](https://demyth.info)，联系邮箱 `Lawyif@163.com`。来源信息不默认写入客户交付物。

## 目的与流程

与用户一起判断：项目真正要解决什么，我们主张什么，客户为什么应该相信，以及怎样让这些判断逐步成立。

```text
理解项目与来源 → 共创关键判断 → 组织 Storyline 与结构参考 → 审阅与修改 → 交给 planners-bypage
```

从已有成果继续。阅读、讨论、补证和组织可以往返；已完成的理解和决定继续沿用。

Proposal 负责上游判断与说服主线；`planners-bypage` 负责完整页面内容、素材、事实核查和终稿；Method Wiki 提供可复用方法，不提供项目答案。

下文 `<Skill>` 是当前 Proposal 目录，`<Project>` 是项目目录，`<SourceIndex>` 是解析到的 `planners-source-index` 目录。按名称找到当前运行环境里的依赖；公共模组由 `proposal-co-creation/scripts/lib/planners-modules.mjs` 解析，缺失时遵循其回执和环境权限处理，不虚构已调用结果。

## 1. 理解项目与建立来源

阅读 Brief、项目要求和相关资料，弄清受众要作出的决定、必要交付，以及预算、时间、资源和事实边界。使用对应文件能力读取正文、数据和视觉内容，区分来源事实、他人判断与当前推论，保留材料冲突和阅读盲区。

将当前理解、关键事实、用户决定和未决问题写入 `.proposal-work/project-memory.md`。带着初步判断进入讨论，只询问会改变判断、且材料无法回答的问题。只有口头描述时先据此研讨，不虚构来源文件。

由 Proposal 建立并随阅读更新 `.proposal-work/source-index.json`。先读取 `planners-source-index` 的入口；字段以其 `contracts/source-index.schema.json` 为准，登记真实资料、原文定位、覆盖范围和必要的可读副本。

公共 Skill 提供契约与校验，不替 Proposal 阅读或生成索引。新增资料或补读后更新登记；正式交接前执行：

```bash
node "<SourceIndex>/scripts/validate-source-index.mjs" "<Project>/.proposal-work/source-index.json"
```

根据返回的 `errors` 修复接口问题，保留真实盲区。`source_root` 相对索引所在目录解析；搬动索引时同步调整路径，确保下游仍能回源。

进入研讨时，应能说明项目要作什么决定、材料支持到哪里，以及哪些未知会影响判断；不是只生成一份摘要或索引文件。

## 2. 共创关键判断

理解项目后，读取并调用 `planners-method-wiki`，围绕当前业务决定或关键疑问查找并应用方法，检查解释角度、遗漏维度和选择后果。传入当前问题、可用材料和同一份项目记忆；方法库选择与采用记录遵循该 Skill。

当问题或方向尚未收敛时，读取并使用 `sparkling`，推导矛盾、比较解释和讨论行动后果。贡献新的观察、证据或取舍；方向已有充分依据时直接深化，不为完成流程制造挑战。

需要用户作商业选择、接受重要风险或改变承诺时，明确提出决定并等待回答。关键证据不足时，使用 `research` 或对应资料能力补证，或将判断保留为待验证解释。

Sparkling 按自己的规范维护白板；项目记忆只接收收敛判断、用户决定、放弃项和未决问题，不复制整个讨论过程。更新旧记录，使当前判断保持一致。

当当前主张、选择理由、行动后果和证据边界足以支持论证时组织主线；仍会改变方向的分歧留在研讨中，不替用户作答。

## 3. 组织 Storyline 与结构参考

从客户最终需要接受的决定反推：哪些判断必须成立，各自凭什么成立，前后怎样承接。回到来源检查关键主张的依据、相反材料和结论边界。

读取 `storytelling`，用于整案或章节的认知推进。先明确使用场景：演讲提案可以逐步展开问题与解法；决策汇报可以先给建议，再在论证部分展开推进。

读取 `slide-copy`，用于幻灯片的标题链、页面角色和信息节奏。形成主线、章节、主要判断及证明需要，不提前写完整逐页文案；一个判断可以由多页证明，具体拆分服从内容。

出现新的解释或论证结构问题时，再针对性调用 `planners-method-wiki`，需要连续推导时查 Recipe。检查主线是否覆盖项目必要交付，是否存在重复、缺证或超过材料强度的主张。

本轮沿用 `proposal-co-creation/contracts/page-architecture.md`，将当前 Storyline 与结构参考写入 `.proposal-work/page-architecture.json`。该文件负责结构表达，项目记忆负责项目理解与决定，不重复维护两份完整 Storyline。

## 4. Storyline 工作台

使用 Proposal 的 adapter 将正式结构交给 `planners-review-core`。公共模组负责统一 UI、编辑器、DSH/本地宿主、保存回执和任务传输；Proposal 负责字段映射与后续判断。Storyline 工作台把每一行当作一句判断，可直接改字、上下拖动、增加或删除页面/判断；保存主稿会回写同一份 `page-architecture.json`，不是另存一份审阅副本。

下文 `<C>` 为 `<Skill>/proposal-co-creation/scripts`；`<A>` 为当前 `page-architecture.json` 的绝对路径；`<R>` 为 `<Project>/.proposal-work/reviews/structure`。

先校验结构，再生成并打开审阅：

```bash
node "<C>/validate-page-architectures.mjs" "<A>"
node "<C>/start-page-review.mjs" --architecture "<A>" --review-dir "<R>"
```

如果当前运行在 DSH 且可用 `review_open`，启动命令加 `--surface-only`，把返回的 `surface` 绝对路径交给审阅插件；插件负责把页面自动挂到侧栏。`surface_ready` 只表示产物已生成，打开状态以插件回执为准。非 DSH，或 DSH 没有审阅插件时，同一入口启动或复用 `planners-review-core` 本地宿主。默认回执读取 `review_context`、`canonical_path`、`workbench_head`；Workbench surface 不声明 legacy 提交文件，不能寻找或创建 `review-submissions.json` 作为主稿。

两条宿主路径共用同一份页面、草稿和 `content-workbench/1`。DSH 中保存主稿自动发生；本地宿主由页面显式保存。“修改本页/提交任务”只追加 pending task 并绑定当前 revision/source hash，不是批准，也不覆盖别的页面。

模型被任务唤醒后：

```bash
读取 "<R>/workbench/head.json" 的 pending tasks；只处理 task 声明的页面，并确认 task 的 revision、source_hash 与当前 head 一致。
处理后重新生成审阅面；若任务对应的内容变化触及主张、数字、主体、时间、限定或证据，交给 planners-fact-check 续检。
```

保存回执成功后，读取 canonical `page-architecture.json` 作为唯一后续输入。不要读取旧 feedback 推断当前版本，也不要把保存或任务提交写成批准。涉及策略选择时回到讨论，修改后重新打开同一工作台。

等待用户操作期间结束当前回合，不轮询。无操作、版本冲突或打开失败时如实处理，保留用户草稿；需要继续时读取同一工作台的 head 和 canonical 主稿。

只有恢复明确的旧项目时才加 `--legacy-review true`。这条兼容路径才会写 `review-submissions.json`，并按“先收件，再校验反馈”的顺序运行 `review-inbox.mjs` 与 `validate-page-review-feedback.mjs`；校验通过后使用回写后的正式结构继续。默认 Workbench 不运行 inbox，不读取 legacy feedback，也不把 `overall_decision` 当作继续工作的前置批准门。

## 5. 交给 planners-bypage

交接或从下游返回修订时，读取 `planners-bypage/references/content-handoff.md`（按名称找到该 Skill）。按其文件归属续接：项目记忆、来源索引和结构原件沿用原路径，当前 Workbench head 只用于确认保存版本和待处理任务；返回修改时继续同一项目文件，不新建一套来源。下游完整稿的事实核查不能由本阶段结构编辑替代。

当前结构主稿已保存、用户明确要求继续，且来源索引有效时，提示用户使用 `$planners-bypage`，并给出可以直接继续工作的交接说明：

- 项目目录，以及 `project-memory.md`、`source-index.json`、`page-architecture.json`、结构 Workbench 目录和 `workbench/head.json` 的绝对路径。
- 已确认的核心判断与选择、重要证据边界、尚未解决的问题；已采用的方法及其库与版本记录保留在同一项目记忆中供下游接续。
- 下游可以发展的页面组织、取材和内容表达，以及哪些变化会实质改变已确认主线。
- 从内容展开继续，不重新询问已有背景，不重复审阅已确认主线；发现主线问题时带着证据与用户讨论。

保留上游文件和有效来源路径，不随手复制索引后使相对定位失效。正式交接前确认项目记忆、来源索引、canonical `page-architecture.json` 和当前 Workbench head 真实存在；来源索引校验通过，实际用于论证的原文件和审计副本可读取，且没有未处理的 revision/source hash 冲突。检查索引的 `warnings`；即使 `valid=true`，实际使用来源缺失也需恢复路径或说明无法完成交接。

用户只要求阶段讨论成果时，可以交出当前理解和主线草稿，明确未决部分；不将它标记为可直接展开的正式交接，直到结构主稿已保存且路径可恢复。

## 完成与后续

本 Skill 的完成是：判断有依据，主线能够展开，用户决定被保留，下游拿到真实可用的输入。格式校验不能代替内容判断。

项目偏好与新的决定更新到项目记忆；一次性改句不升级 Skill。完整逐页内容、实际使用事实的独立核查和终稿审阅由 `planners-bypage` 继续完成。维护接口时参考 `references/architecture.md`；升级记录位于 `references/maintenance-history.md`，不在生产运行中加载历史记录。
