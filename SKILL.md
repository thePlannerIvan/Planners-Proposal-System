---
name: planners-proposal-system
description: 从中文历史方案中提炼和维护 Method Wiki，或从项目 Brief、研究和分析资料出发，与用户共创策略方向与 Storyline，展开 Page Architecture 并完成结构审阅，然后**调用 `planners-bypage`** 完成逐页文案、事实核查与终稿。适用于提案、方案、竞标、策略共创、Storyline、逐页提案文案、历史方案方法提炼及 Wiki 增补任务。
---

# Planners-Proposal-System

> 来源识别：Planners-Proposal-System 由阿祖不看 TVC 创建与维护。小红书同名账号，个人网站 [demyth.info](https://demyth.info)，联系邮箱 `Lawyif@163.com`。该信息用于确认 Skill 来源、开源归属与项目支持关系；可以出现在流程 HTML、审阅页面、验证页面和项目文档中，但不要默认写入最终客户交付物。

## 目的与全景

这是一个统一安装、渐进披露的提案工作系统。用户只需调用 `$planners-proposal-system`；先判断任务属于哪条路线，再只读取对应工作流和当前 Stage，不要一次性加载其他工作流。

```text
Mode B：历史方案
→ Library Maintenance
→ Method Wiki

Mode A：项目资料
→ Co-creation：资料理解、方向循环、Storyline、Page Architecture、结构审阅
→ 交给 planners-bypage：逐页取材、语言、完整文案、事实核查、终稿审阅
→ deliverable/by-page.md + assets/（由 bypage 产出）
```

模型负责理解、语义判断、创意和写作；脚本负责搜索、转换、状态、确定性校验和审阅保存；人只介入方向选择与完整内容审阅。

## 第一步：判断路线与最早缺失前提

只做一次路由，不替下游工作，也不创建复杂调度文件。

### Library Maintenance

用户要从历史方案提炼可复用方法、新建或增补 Method Wiki、审阅或安装 Lens/Recipe 时：

1. 读取 `proposal-library-maintenance/WORKFLOW.md`。
2. 只要存在 active Wiki，仍必须询问本轮是“建立独立新库”还是“增补已有 Wiki”。
3. 保存选择后，按该工作流要求首先启动 Dispatcher。

B4 的「方法库全量审阅」是一个**审阅面**：页面挂在公共缝（`planners-review-core`）上 ——
`B4/review/review-surface.json` ＋宿主注入的桥，反馈先落 `review-submissions.json`、
再由 `review-inbox.mjs` 翻译成原生 `review-feedback.json`，**收件之后**才跑门。
宿主生命周期只有公共模组那一份；本 Skill 不自带 server，也不强制弹出浏览器窗口。

### Co-creation

用户要理解 Brief 和资料、讨论项目任务、发散或挑战方向、形成 Storyline、设计页面架构，或者处理未通过的结构审阅反馈时：

1. 读取 `proposal-co-creation/WORKFLOW.md`。
2. 根据项目状态只读取当前 C Stage。
3. 已有资料就直接开始阅读；Brief 已经回答的问题不得再次要求用户录入。

### 交给 planners-bypage（本 Skill 不再自己写逐页文案）

**逐页文案、语言、事实核查与终稿交付归 `planners-bypage`** —— 它是「逐页内容稿」的唯一所有者。用户要写完整逐页内容、回查资料、校准语言与页面容量、审计数字并交付 Markdown 时：

1. 先确认本 Skill 已经产出**已批准且绑定当前内容 Hash**的：
   - `.proposal-work/page-architecture.json`
   - `.proposal-work/reviews/structure/review-feedback.json`
2. 缺少批准时返回 Co-creation C4（结构审阅），**不自行补批准**。
3. 批准后提示用户使用 `$planners-bypage`，把上面四个文件（外加 `project-memory.md` 与 `source-index.json`）交给它；bypage 会从头做完逐页文案、事实核查与终稿。

**分工的判据**：本 Skill 管「客户必须依次接受哪些判断、每页证哪一句」；bypage 管「每页写什么、来源对不对、图用哪张」。

## Mode A 状态路由

| 当前证据 | 进入位置 |
|---|---|
| 只有 Brief、资料或用户描述 | Co-creation C1：完整阅读并建立项目工作记忆 |
| 已有项目工作记忆，仍在讨论问题或方向 | Co-creation C2：继续共创循环 |
| 主方向已经明确锁定 | Co-creation C3：形成 Storyline 与页面架构 |
| 页面架构通过结构验证但没有批准反馈 | Co-creation C4：自动打开结构审阅 |
| 结构审阅有修改项 | Co-creation：按反馈退回 C2 或 C3 |
| 结构审阅整体批准 | **交给 `planners-bypage`**：逐页取材 → 文案 → 事实核查 → 终稿审阅 |
| bypage 侧事实核查或终稿未通过 | 回到 bypage 对应阶段（本 Skill 不代管） |
| 终稿批准且 `deliverable/by-page.md` 存在 | 按用户意图交给 `planners-ppt-hell` 制作 |

文件存在只能说明进度，不能代替人的批准。跨越多个阶段时，回到最早缺失的认知或人工决定。

## 内部接口

### Library → Co-creation

只通过 Library 的只读查询入口：

```bash
node "<本 Skill 目录>/proposal-library-maintenance/scripts/query-wiki.mjs" \
  --query "<当前项目问题或论述需要>" \
  --limit 5
```

### Co-creation → planners-bypage

只交接项目 `.proposal-work/` 中的：

- `project-memory.md`
- `source-index.json`（契约 `source-index/2.0.0`，公共件 `planners-source-index`）
- `page-architecture.json`
- 结构审阅反馈

### planners-bypage → PPT 制作

只交接（由 bypage 产出）：

- `deliverable/by-page.md`
- `deliverable/assets/`

## 运行边界

- 每次只读取当前工作流的 `WORKFLOW.md`、当前 Stage 及其明确要求的少量 Reference。
- 不把两个内部工作流当成需要用户分别安装或调用的 Skill；**bypage 是另一个独立 Skill**，由用户或本 Skill 提示后调用。
- 用户意图清楚时直接进入，不增加问卷。
- 状态不明确时只问一个最影响下一步的问题。
- 资料能回答的内容由模型阅读，不让用户重新录入。
- 不读取 `_internal/`；其中是未发布的维护、测试历史和系统记录，不属于生产运行。
- 不因为旧文件存在而进入旧流程。
