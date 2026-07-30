# Planners-Proposal-System

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Skill](https://img.shields.io/badge/Codex%20%2F%20Claude-Skill-111827)](SKILL.md)
[![Tests](https://github.com/thePlannerIvan/Planners-Proposal-System/actions/workflows/validate.yml/badge.svg)](https://github.com/thePlannerIvan/Planners-Proposal-System/actions/workflows/validate.yml)

一套面向中文商业提案的 AI 工作系统：从历史方案方法库、项目策略共创和 Storyline，到逐页文案、数字事实审计、HTML 审阅及可编辑 Markdown 交付。

作者：**阿祖不看 TVC**

- 小红书：阿祖不看 TVC
- 网站：[demyth.info](https://demyth.info)
- 邮箱：[Lawyif@163.com](mailto:Lawyif@163.com)

## 它解决什么问题

很多提案 Skill 不是缺少步骤，而是模型看不清全景、每阶段只拿到文件索引、脚本增加负担、人被迫审阅低价值工程字段。本项目把工作重新分成：

- 模型理解资料、提出判断、共创方向并完成写作；
- 脚本处理转换、状态、确定性校验、事实定位和审阅保存；
- 人只参与方向选择与完整内容审阅；
- Contract 只保护真正的机器交接。

## 核心工作流

```text
历史方案
→ Library Maintenance
→ Method Wiki

项目 Brief / 研究 / 分析资料
→ Co-creation
→ 主方向与 Storyline
→ Page Architecture
→ By-page Copy
→ 数字事实审计
→ HTML 审阅
→ proposal.md + assets/
```

整个系统只有一个公开入口：`$planners-proposal-system`。Router 会根据用户意图和项目状态渐进读取对应内部工作流，不需要分别安装或记忆多个 Skill 名称。

## 适合

- 中文商业提案、年度营销方案、品牌策略和竞标方案；
- 从复杂资料中形成方向、Storyline 和逐页内容；
- 从历史方案提取可复用 Lens、Recipe 与 Method Wiki；
- 需要人机共创、结构审阅、文案审阅和数字追溯的项目。

## 不适合

- 只要求普通摘要、翻译或润色；
- 直接生成最终视觉设计或 PPT 文件；
- 把未经审阅的历史结论机械套用到新项目；
- 用脚本代替策略判断、创意判断或人的最终承诺。

## 安装

### Skills CLI

```bash
npx skills add https://github.com/thePlannerIvan/Planners-Proposal-System --skill planners-proposal-system
```

### Codex

```bash
git clone https://github.com/thePlannerIvan/Planners-Proposal-System.git \
  ~/.codex/skills/planners-proposal-system
```

### Claude Code

```bash
git clone https://github.com/thePlannerIvan/Planners-Proposal-System.git \
  ~/.claude/skills/planners-proposal-system
```

重启对应客户端或重新加载 Skill 后即可调用。

## 典型用法

```text
使用 $planners-proposal-system，先完整阅读这个项目文件夹的 Brief 和研究资料，
和我一起确定策略方向，再形成 Storyline 和逐页方案。
```

```text
使用 $planners-proposal-system，把这套历史方案提炼成一个新的 Method Wiki。
```

```text
使用 $planners-proposal-system，继续这个已经批准 Page Architecture 的项目，
完成逐页文案、数字核对和最终审阅。
```

## 目录

```text
planners-proposal-system/
├── SKILL.md
├── agents/
├── proposal-library-maintenance/
├── proposal-co-creation/
├── proposal-by-page-copy/
├── evals/
└── package.json
```

`proposal-system-maintenance`、系统架构、升级记录、内部真实案例和历史归档不属于公开发布内容。

## 本地验证

```bash
npm ci
npm test
```

公开测试覆盖单一 Router、Library、Co-creation 和 By-page Copy 的活动接口与关键行为。

## 品牌、署名与最终交付

仓库文档、过程 HTML、审阅页面和验证页面可以显示项目来源与作者署名。Skill 默认不得把 Planners-Proposal-System、作者或网站标识写入客户最终提案、PPT、图片和交付文档。

开源许可证不授予冒充官方项目、作者背书或商业品牌授权的权利，详见 [TRADEMARK.md](TRADEMARK.md)。

## 开源与商业合作

本项目采用 [GNU Affero General Public License v3.0](LICENSE)。私有部署、企业流程适配、闭源授权、培训与咨询见 [COMMERCIAL.md](COMMERCIAL.md)。
