# 内部工作流：提案方法库维护

## 目的与全景

目标是保存可在新项目中重复执行的**方法**，不是保存历史方案答案。Lens 必须保留“问题—输入—操作—输出—边界”，剥离品牌、品类、slogan、场景、项目结论、预算、执行填充值和创意成品。Recipe 保存多个 Lens 的推导顺序，帮助未来组织方案；它可以跨 Module，不是固定页数或 PPT 模板。

```mermaid
flowchart LR
  S0["S0 选择独立建库或增补"] --> B1["B1 按页 Markdown"]
  B1 --> B2["B2 语义单元 + 可丢页"]
  B2 --> B3a["B3a 发现 Recipe"]
  B3a --> B3b["B3b 提取并去项目化 Lens"]
  B3b --> B3c["B3c 内部归并与自检"]
  B3c --> D{"增补已有库？"}
  D -- 是 --> B3d["B3d 深度对照已有 Wiki"]
  D -- 否 --> B4["B4 完整人工审阅"]
  B3d --> B4 --> B5["B5 确定性安装"] --> B6["B6 真实使用验证"]
```

## 启动

1. 有活动 Wiki 时，必须请用户选择“独立新库”或“增补已有 Wiki”；不得猜测。保存 S0 意图后才能开始。
   如当前项目尚未完成入口检查，先返回根 `SKILL.md`完成路由；方法库运行仍以本工作流的 S0 意图为准。
2. Router 保存 `library-run-intent.json` 后，本工作流的第一条执行命令必须启动调度器。不得先手工创建 B1–B6 目录或运行语义脚本：

```bash
node "<Planners-Proposal-System 目录>/proposal-library-maintenance/scripts/library-dispatch.mjs" \
  --run-dir <运行目录> \
  --action start \
  --intent-file <library-run-intent.json>
```

3. 调度器的返回值会直接包含当前 Stage 的路径、完整中文任务与必需 Validator。每次只执行 `current_instruction`，不得自行打开后续 Stage。不存在第二套需要模型读取的运行协议；工程历史、archive 和 iteration 不进入正式运行上下文。

## 阶段职责

正式语义产物链是 `semantic-unit-plan/1.0.0` → `recipe-discovery/1.0.0` → `lens-extraction/1.0.0` → `library-curation/2.0.0` →（仅增补）`wiki-change-candidate/2.0.0`。B4 与 B5 始终消费 B3c 冻结的完整对象，不再生成第二套草稿。

| 阶段 | 模型唯一任务 | 脚本唯一任务 | 人工 |
|---|---|---|---|
| B1 | 无 | 产生按页 Markdown、页码与来源定位 | 无 |
| B2 | 把保留页面组成可非连续的语义单元；列出明确无价值页 | 校验页引用、物化单元原文 | 无 |
| B3a | 在整套单元中发现可复用 Recipe 与步骤依赖 | 打包完整 Deck 单元 | 无 |
| B3b | 从单元抽取并去项目化 Lens、Module、页面结构 | 打包单元及 Recipe 上下文 | 无 |
| B3c | 在本轮内部合并、拆分、变体化，冻结完整 Lens/Recipe | 校验来源、Recipe 引用和完整冻结对象 | 无 |
| B3d | 仅增补路线：逐 Lens/Recipe 对照已有 Wiki | 生成含完整 Module/Lens/Recipe 的 Wiki snapshot | 无 |
| B4 | 无 | 直接打开完整审阅页、保存反馈 | 审阅每项变更 |
| B5 | 无 | 只按 B4 决定备份、安装、建 revision、更新索引 | 已批准决定 |
| B6 | 在真实项目中检验价值 | 固定测试输入与记录 | 解释实际价值 |

## 阶段文件

每次进入阶段先读唯一对应的 `stages/B*.md`。阶段文件同时包含任务背景、判断方法、禁止事项、诚实终态、输出和自检；不再另设会与其重复的 instruction 文件。

所有语义字段、判断、任务指令和示例均使用中文。脚本只能准备原文、打包上下文、校验格式/来源/状态以及执行已批准安装；不得生成、补全、截断或替代模型的语义结果。脚本生成的占位 Lens、固定三页结构和从 rationale 猜 operations 都属于无效产物。

## B4 与安装

B4 必须用 `start-review-session` 直接打开 review URL，并把运行状态设为 `waiting_for_human`。命令打开页面后立即返回；模型告诉用户在网页保存后回到 Codex 发送“已完成”，然后结束当前回合，不保持终端等待或轮询。用户返回后先确认本次 `review-feedback.json` 存在并运行 B4 Validator，才能继续 B5。审阅对象是完整 Lens/Variant/Recipe/Module 变更和页面结构，不是 B2 页面切分。增补路线才显示“合并到哪个既有 Lens”；新建路线不显示合并选项。先完成 Lens 决策，再审 Recipe 的最终依赖；依赖被拒绝、暂缓或没有安装去向时不能批准 Recipe。`merge` 和 `revision` 必须提交人工确认后的完整最终对象，安装器不得自动拼接或用新对象覆盖旧对象。反馈必须逐项结构化保存，未处置项不能安装。

阶段通过只能由 `verify` 校验回执、产物哈希和调度器内置的当前阶段强制 Validator 后推进。调度器拒绝其他 Validator。B5 还必须通过安装后 Wiki 引用图完整性检查，确保 Recipe、step、Lens、Module 与索引没有悬空引用。失败时记录 blocker，修复同一阶段产物后重试；不得用占位结果、模型自报完成或直接修改 run-state 绕过。

## 活跃文件边界

- `stages/`：模型在各阶段需要看到的完整中文任务定义。
- `contracts/`：阶段输出及最终 Wiki 的机器可读边界；不替代语义任务说明。
- `scripts/`：分页、打包、校验、B4 server/页面和 B5 安装。
- `base-wiki/`：随 Skill 提供的活动基础库；增补时只从 B3d 起读取。

不再存在独立 `instructions/` 或活跃 `workflow/`；阶段目的、方法、禁止事项、命令和完成标准只在 `stages/B*.md` 维护一份。机械阶段映射、必需 Validator、状态推进与恢复条件只存在于 `library-dispatch.mjs`。

## 运行后迭代

每次运行后做 Memory Audit：当前运行问题留在运行记录；项目约束写入项目 memory；反复出现的流程问题才升级到任务卡、Contract 或脚本；失效的旧规则和资源移出活跃路径。B6 发现的锚定、套模板、抽象不足或检索失败必须按所属阶段记录，不能只写笼统总结。
