# Planners-Proposal-System

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Skill](https://img.shields.io/badge/Codex%20%2F%20Claude-Skill-111827)](SKILL.md)
[![Tests](https://github.com/thePlannerIvan/Planners-Proposal-System/actions/workflows/validate.yml/badge.svg)](https://github.com/thePlannerIvan/Planners-Proposal-System/actions/workflows/validate.yml)

面向中文商业提案的策略共创 Skill：理解项目资料，与用户形成关键判断、Storyline 和结构参考，完成结构审阅后交给 `planners-bypage` 展开内容。

作者：**阿祖不看 TVC**

- 小红书：阿祖不看 TVC
- 网站：[demyth.info](https://demyth.info)
- 邮箱：[Lawyif@163.com](mailto:Lawyif@163.com)

## 它解决什么问题

本 Skill 将策略判断、机械工具和人工决定分开：

- Proposal 理解资料、共创判断、组织说服路径并交接；
- sparkling、storytelling、slide-copy 分别提供研讨、叙事和甲板组织方法；
- 脚本处理只读查询、接口校验、审阅保存和编辑回写；
- 用户作商业选择、确认结构；By-page 继续逐页内容、素材、核查和终稿。

## 核心工作流

```text
项目 Brief / 研究 / 分析资料
→ 理解项目与建立来源
→ 共创关键判断（按问题查询 Method Wiki）
→ Storyline 与结构参考
→ 审阅与修改
→ 交给 planners-bypage
```

写方案的完整流程只在 [SKILL.md](SKILL.md) 维护，从已有成果继续，不再按 C1-C4 门槛逐项路由。来源索引、Wiki 查询、审阅收件和下游交接都有具体入口。

Method Wiki 已独立为 `planners-method-wiki`，统一拥有 Lens / Recipe 查询、方法审阅与维护。Proposal 与 By-page 调用同一 Skill 和项目方法库，已采用方法保留在原项目记忆中。

旧 `proposal-library-maintenance/scripts/query-wiki.mjs` 仅作为转发入口保留，供既有调用兼容；它不包含方法库或维护流程。

## 适合

- 中文商业提案、年度营销方案、品牌策略和竞标方案；
- 从复杂资料中形成方向、Storyline 和可展开的结构参考；
- 重新讨论或组织既有方案主线；
- 需要可靠来源、可编辑结构审阅和完整下游交接的项目。

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
- `planners-method-wiki` —— 方法库查询、应用与维护；生产时调用只读查询分支

方法层按任务读取当前环境中的 `sparkling`、`storytelling`、`slide-copy`，取证时可使用 `research`。这些原子 Skill 不在本仓库中；缺少时应说明可用能力，不能声称已经调用。完整内容的独立事实核查由 By-page 继续负责。

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
和我一起确定策略方向，再形成 Storyline 和结构参考，审阅后交给 planners-bypage。
```

```text
使用 $planners-proposal-system，把这份已明确方向的汇报组织成结论先行的 Storyline。
```

```text
使用 $planners-proposal-system，检查这个已批准结构项目的来源与反馈，
给出可以直接交给 planners-bypage 的四文件路径、已确认判断和发展空间。
```

## 目录

```text
planners-proposal-system/
├── SKILL.md
├── agents/
├── proposal-co-creation/
├── evals/
└── package.json
```

`proposal-system-maintenance`、系统架构、升级记录、内部真实案例和历史归档不属于公开发布内容。

## 本地验证

```bash
npm ci
npm test

# 公共模组自动安装器自己的测试
node --test proposal-co-creation/scripts/lib/planners-modules-install.test.mjs
```

公开测试覆盖主入口、独立 Wiki 调用、结构审阅与真实浏览器编辑回写，以及来源 → Wiki → 审阅 → 四文件交接的完整接口链路和负例。方法维护在 `planners-method-wiki` 测试，逐页内容在 `planners-bypage` 测试；工程通过不等于真实客户稿的说服力已经验收。

## 品牌、署名与最终交付

仓库文档、过程 HTML、审阅页面和验证页面可以显示项目来源与作者署名。Skill 默认不得把 Planners-Proposal-System、作者或网站标识写入客户最终提案、PPT、图片和交付文档。

开源许可证不授予冒充官方项目、作者背书或商业品牌授权的权利，详见 [TRADEMARK.md](TRADEMARK.md)。

## 开源与商业合作

本项目采用 [GNU Affero General Public License v3.0](LICENSE)。私有部署、企业流程适配、闭源授权、培训与咨询见 [COMMERCIAL.md](COMMERCIAL.md)。
