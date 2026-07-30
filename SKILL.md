---
name: planners-proposal-system
description: 从中文历史方案中提炼和维护 Method Wiki，或从项目 Brief、研究和分析资料出发，与用户共创策略方向与 Storyline，展开 Page Architecture，完成逐页提案文案、数字事实审计、HTML 审阅和 Markdown 交付。适用于提案、方案、竞标、策略共创、Storyline、逐页文案、历史方案方法提炼及 Wiki 增补任务。
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
→ By-page Copy：逐页取材、样页校准、完整文案、事实审计、终稿审阅
→ deliverable/proposal.md + assets/
```

模型负责理解、语义判断、创意和写作；脚本负责搜索、转换、状态、确定性校验和审阅保存；人只介入方向选择与完整内容审阅。

## 第一步：判断路线与最早缺失前提

只做一次路由，不替下游工作，也不创建复杂调度文件。

### Library Maintenance

用户要从历史方案提炼可复用方法、新建或增补 Method Wiki、审阅或安装 Lens/Recipe 时：

1. 读取 `proposal-library-maintenance/WORKFLOW.md`。
2. 只要存在 active Wiki，仍必须询问本轮是“建立独立新库”还是“增补已有 Wiki”。
3. 保存选择后，按该工作流要求首先启动 Dispatcher。

### Co-creation

用户要理解 Brief 和资料、讨论项目任务、发散或挑战方向、形成 Storyline、设计页面架构，或者处理未通过的结构审阅反馈时：

1. 读取 `proposal-co-creation/WORKFLOW.md`。
2. 根据项目状态只读取当前 C Stage。
3. 已有资料就直接开始阅读；Brief 已经回答的问题不得再次要求用户录入。

### By-page Copy

用户要把已经批准的页面架构写成完整逐页内容、回查资料、校准语言与页面容量、审计数字并交付 Markdown 时：

1. 读取 `proposal-by-page-copy/WORKFLOW.md`。
2. 确认项目存在已批准且绑定当前内容 Hash 的：
   - `.proposal-work/page-architecture.json`
   - `.proposal-work/reviews/structure/review-feedback.json`
3. 缺少批准时返回内部 Co-creation 工作流，不自行补批准。

## Mode A 状态路由

| 当前证据 | 进入位置 |
|---|---|
| 只有 Brief、资料或用户描述 | Co-creation C1：完整阅读并建立项目工作记忆 |
| 已有项目工作记忆，仍在讨论问题或方向 | Co-creation C2：继续共创循环 |
| 主方向已经明确锁定 | Co-creation C3：形成 Storyline 与页面架构 |
| 页面架构通过结构验证但没有批准反馈 | Co-creation C4：自动打开结构审阅 |
| 结构审阅有修改项 | Co-creation：按反馈退回 C2 或 C3 |
| 结构审阅整体批准，尚无样页反馈 | By-page P1–P3：接收、取材并自动打开样页审阅 |
| 样页批准，正在完成全稿 | By-page P4 |
| 全稿完成但事实审计或终稿审阅未通过 | By-page P5 |
| 终稿审阅批准且 `deliverable/proposal.md`存在 | 按用户意图交给 PPT 制作或结束 |

文件存在只能说明进度，不能代替人的批准。跨越多个阶段时，回到最早缺失的认知或人工决定。

## 内部接口

### Library → Co-creation

只通过 Library 的只读查询入口：

```bash
node "<本 Skill 目录>/proposal-library-maintenance/scripts/query-wiki.mjs" \
  --query "<当前项目问题或论述需要>" \
  --limit 5
```

### Co-creation → By-page Copy

只交接项目 `.proposal-work/`中的：

- `project-memory.md`
- `source-index.json`
- `page-architecture.json`
- 结构审阅反馈

### By-page Copy → PPT 制作

只交接：

- `deliverable/proposal.md`
- `deliverable/assets/`

## 运行边界

- 每次只读取当前工作流的 `WORKFLOW.md`、当前 Stage 及其明确要求的少量 Reference。
- 不把三个内部工作流当成需要用户分别安装或调用的 Skill。
- 用户意图清楚时直接进入，不增加问卷。
- 状态不明确时只问一个最影响下一步的问题。
- 资料能回答的内容由模型阅读，不让用户重新录入。
- 不读取 `_internal/`；其中是未发布的维护、测试历史和系统记录，不属于生产运行。
- 不因为旧文件存在而进入旧流程。
