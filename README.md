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
→ 结构审阅
→ 交给 planners-bypage：逐页文案 · 语言 · 事实核查 · 终稿审阅
→ by-page.md + assets/（由 bypage 产出）
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

## 公共模组（缺了会自动装）

本 Skill 依赖若干**公共模组**（独立发布的条目，不是本仓库的一部分）：

- [`planners-review-core`](https://github.com/thePlannerIvan/planners-review-core) —— 审阅面契约、桥与本地宿主
- [`planners-source-index`](https://github.com/thePlannerIvan/planners-source-index) —— 来源索引契约与唯一校验器
- [`planners-fact-check`](https://github.com/thePlannerIvan/planners-fact-check) —— 事实核查契约与校验器
- [`planners-report-kit`](https://github.com/thePlannerIvan/planners-report-kit) —— 报告装配与校验（仅带报告出口的 Skill 需要）

某个模组不在本地时，本 Skill 的适配器会**自动从 GitHub 装它**，不需要手动准备。适配器找的地方按顺序：

1. `$PLANNERS_MODULES_HOME/<模组名>`
2. 本 Skill 的兄弟目录 `<skills-root>/<模组名>`（发布后的主路径）
3. monorepo 里 `02-skills-library/<分类>/<模组名>`
4. **用户级安装根**：`$PLANNERS_MODULES_INSTALL_DIR` → `$PLANNERS_MODULES_HOME`（仅当它已含该模组，或那目录还不存在）→ 默认 `~/.planners-modules/<模组名>`

前三条都没有时才自动安装（顺序不变，**本地永远优先、不会无条件联网**）；装到第 4 条那个**库外**用户级目录，**绝不写进** `02-skills-library` 工作树、`~/.codex|~/.claude|~/.gemini` 的技能目录、或任何系统目录。安装过程**不静默**：会打印缺哪个、找过哪些路径、从哪个 URL 装、装到哪、用的是 `git clone --depth 1` 还是 `npx skills add`、以及装到的 **commit**。装完先在暂存目录里验证（`SKILL.md` + 该模组声明的契约/校验器锚点文件都在），再用 rename 原子就位；**任何失败都会清掉暂存、不留半成品**，并给出可复制的手动安装命令。

要它**只报不装**（CI／离线／审计）：

```bash
PLANNERS_NO_AUTO_INSTALL=1 <你的命令>
```

| 环境变量 | 作用 |
|---|---|
| `PLANNERS_MODULES_HOME` | 指定已有模组所在目录（解析第 1 条，也兼作安装根） |
| `PLANNERS_MODULES_INSTALL_DIR` | 只指定**自动安装**的落点（优先级高于上面那条） |
| `PLANNERS_MODULES_REF` | 要钉的 tag 或分支（不设 = 装默认分支 HEAD） |
| `PLANNERS_NO_AUTO_INSTALL=1` | 只报不装；缺依赖时如实失败并打印手动命令 |

装的是**默认分支 HEAD**，日志里**永远打 commit**；HEAD 恰好被某个 tag 指着时，tag 也一并打出来。想钉版本就设 `PLANNERS_MODULES_REF`：

```bash
PLANNERS_MODULES_REF=v1.0.0 <你的命令>     # 钉在 tag 上
PLANNERS_MODULES_REF=main   <你的命令>     # 钉在某个分支上
```

钉了不存在的 ref 会**如实失败**（不会悄悄退回 HEAD），错误里带正确的可复制命令。

### 两条命令别搞混：谁装 Skill，谁抓依赖

**用户装一个 Skill** —— 用 Skills CLI，它会把条目放进各 agent 的技能目录：

```bash
npx skills add https://github.com/thePlannerIvan/<Skill 名> --skill <Skill 名>
```

**Skill 自己抓一个公共模组（内部依赖）** —— 用 `git clone`，落在库外的单一安装根：

```bash
git clone --depth 1 https://github.com/thePlannerIvan/<模组名>.git \
  "$HOME/.planners-modules/<模组名>"
# 想钉版本：加 --branch v1.0.0
```

**内部依赖为什么不走 `npx skills add`**：它没有 `--dir` 之类的落点参数，只会写进 `~/.claude/skills`、`~/.codex/skills` 这类 **runtime 技能目录**（那是发布器的领地，写进去等于多一份漂移副本）；而且它下载的目录**不带 `.git`**，拿不到 commit、也就没法追溯装的是哪一版。**门面命令归用户，内部依赖归 clone** —— 上面自动安装走的就是这条。


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
├── evals/
└── package.json
```

`proposal-system-maintenance`、系统架构、升级记录、内部真实案例和历史归档不属于公开发布内容。

## 本地验证

```bash
npm ci
npm test

# 公共模组自动安装器自己的测试（两个入口各一份）
node --test proposal-co-creation/scripts/lib/planners-modules-install.test.mjs
node --test proposal-library-maintenance/scripts/lib/planners-modules-install.test.mjs
```

公开测试覆盖单一 Router、Library 与 Co-creation 的活动接口与关键行为（逐页文案在 `planners-bypage` 自己的仓库里测）。

## 品牌、署名与最终交付

仓库文档、过程 HTML、审阅页面和验证页面可以显示项目来源与作者署名。Skill 默认不得把 Planners-Proposal-System、作者或网站标识写入客户最终提案、PPT、图片和交付文档。

开源许可证不授予冒充官方项目、作者背书或商业品牌授权的权利，详见 [TRADEMARK.md](TRADEMARK.md)。

## 开源与商业合作

本项目采用 [GNU Affero General Public License v3.0](LICENSE)。私有部署、企业流程适配、闭源授权、培训与咨询见 [COMMERCIAL.md](COMMERCIAL.md)。
