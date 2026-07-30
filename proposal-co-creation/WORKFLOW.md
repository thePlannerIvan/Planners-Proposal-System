# 内部工作流：提案共创

## 目的与方法

本 Skill 帮助人和模型共同完成提案最需要判断力的上游工作：

```text
读懂全部项目资料
→ 建立不会随对话丢失的项目工作记忆
→ 向用户汇报真实阅读覆盖并建立提案语言基线
→ 发现问题与机会
→ 人与模型循环发散、追问、反驳和选择
→ 锁定一个主方向
→ 组织客户认知改变的 Storyline
→ 按证明需要展开为页面
→ 自动打开一次结构审阅
→ 交给 By-page Copy
```

资料提供事实和边界；Method Wiki 提供少量思考工具；模型负责理解、联想、提出判断和反例；人负责战略选择与最终承诺。不要用一堆 Contract 代替共创，也不要把聊天中的灵感当作已经确认的方向。

## 与上下游的关系

- 不清楚属于方法库、共创还是逐页文案时，返回根 `SKILL.md`重新路由。
- 需要方法时，只通过 Library 的只读查询入口限量读取 active Wiki。
- 本 Skill 只向 By-page Copy 交付：
  - `.proposal-work/project-memory.md`
  - `.proposal-work/source-index.json`
  - `.proposal-work/page-architecture.json`
  - 结构审阅反馈
- 本 Skill 不写最终 PPT 文案，也不提前替后续制作决定所有图表、图片和版式。
- 结构审阅批准后，除非用户只要求共创，直接读取 `../proposal-by-page-copy/WORKFLOW.md`继续，不重新询问已经确认的背景。

## 项目目录

所有运行状态写入用户项目目录：

```text
<project>/
└── .proposal-work/
    ├── project-memory.md
    ├── source-index.json
    ├── page-architecture.json
    └── reviews/
        └── structure/
```

不要把运行产物写进 Skill 目录。不要在项目根目录散落 Storyline、Decision State、Project Boundary、Module Packet 等工程文件。

不要自行创建没有下游消费者的 `conversation-log.md`、`work-log.md`、`execution-summary.md`或重复总结。过程更新留在对话，跨阶段仍需使用的判断只进入 `project-memory.md`。

## 运行方式

每次只读取当前阶段的完整中文任务：

1. `stages/C1-project-understanding.md`：完整阅读、来源索引与项目工作记忆。
2. `stages/C2-direction-loop.md`：机会发现、方向发散、挑战与主方向锁定。
3. `stages/C3-storyline-page-architecture.md`：Storyline 与页面架构一次形成。
4. `stages/C4-structure-review.md`：自动打开结构审阅、接收反馈并交接。

核心任务以 Stage 为唯一完整定义。`references/`只在 Stage 明确要求时提供方法知识，不得一次性通读。

## 四条运行原则

### 1. 先读再问

先完成资料阅读和项目工作记忆，再进入讨论。Brief 已经回答的问题不再问用户。第一次与用户互动先给出阅读覆盖回执、当前理解、关键张力和初步判断，只问真正会改变方向的问题。

### 2. 共创是循环

每一轮模型都要带来新的观察、推论、反例或组合可能，再提出聚焦问题。允许回到资料、重建问题、推翻方向；不按字段清单机械前进。

用户最先提出的方向只是候选起点。必须经过至少一次模型贡献的挑战、替代或取舍，并由用户确认深化后的方向；发现阶段被跳过时立即回退补做。模型提出会改变方向的问题后必须结束当前回合，等待用户真实回答，不能自己连续完成问答并直接进入 Storyline。方向还必须落在消费者真实需求、竞品未可信占据位置与 Brand Best Self 的核心交集；任一圈没有项目证据都不能锁定。

### 3. Storyline 不等于页数

Storyline 描述客户必须依次接受的认知变化。一个认知节点可以展开为数页，因为事实、比较、案例、模型和行动含义可能需要分别证明。模型先拆证明负担，再组成独立证明单元并审计页面容量；最终页数由论证完整性决定，不由 Storyline 句数决定。

### 4. 只进行一次结构确认

方向在自然对话中明确锁定。随后 Storyline 和 Page Architecture 一起形成、一起进入 HTML 审阅。不要先让用户确认 Storyline，再让用户重复确认同一结构的页面版本。

## Wiki 的两次介入

不得跳过 Wiki，也不得全库通读：

1. 完成资料理解后，限量查询相关 Lens，用于发现遗漏角度、挑战表面解释和改进问题定义。
2. Storyline 已由项目事实完整形成后、Page Architecture 开始前，按主要认知板块限量查询相关 Lens/Recipe，用于补齐论述模式、缺失证明环节和成熟的页面结构；必须记录实际补充了什么，不能等结构审阅被用户指出缺口后才查。

Wiki 不提供项目答案，不得替代资料形成结论。每次都至少保留一个直接从项目材料产生、没有被 Wiki 预设的角度。

## 正式结构边界

按照 `contracts/page-architecture.md`生成 `.proposal-work/page-architecture.json`，再运行：

```bash
node "<Planners-Proposal-System 目录>/proposal-co-creation/scripts/validate-page-architectures.mjs" \
  "<project>/.proposal-work/page-architecture.json"
```

Validator 只检查交接结构，不证明方向或 Storyline 已经成熟。

## 人机交互

必须找人：

- 多个方向会导致明显不同的商业选择；
- 材料冲突且优先级依赖业务判断；
- 准备改变范围、受众、预算或承诺；
- 准备把工作假设升级为正式主张；
- 方向经挑战后可能不成立；
- 准备锁定唯一主方向；
- 结构审阅需要决定是否修改。

模型自行推进：

- 文件清点、读取、来源定位和摘要；
- Brief 已明确的事实；
- 可以继续查资料解决的问题；
- 不改变方向的低影响表达选择。

## 完成标准

本 Skill 只有同时满足以下条件才完成：

- 项目资料已按决策相关性完整阅读，工作记忆可回到原文；
- 用户没有被重复询问 Brief 已回答的问题；
- 主方向经过发散、反例和取舍，且用户明确认可；
- Storyline 是认知推进，不是惯常目录；
- 每页只证明一个判断，内容块足以支撑判断；
- 页面数量由证明需要决定；
- 结构文件通过验证；
- HTML 审阅由脚本自动打开；
- 反馈绑定当前结构文件，整体决定为 `approve`；
- 已明确交接给 By-page Copy。

## 运行后迭代

运行结束时只记录会改变后续行为的学习：

1. 当前项目偏好和约束更新到 `project-memory.md`。
2. 单次表达修改不写入 Skill。
3. 连续复现的流程问题只记录为系统维护问题；生产运行不读取未发布的 `_internal/`。
4. 已失效的工作记忆、旧 Contract 和旧脚本必须移出 Active 路径，防止沉积。
