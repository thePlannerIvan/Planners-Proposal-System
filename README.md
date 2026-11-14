# Planners Proposal System

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Tests](https://github.com/thePlannerIvan/Planners-Proposal-System/actions/workflows/validate.yml/badge.svg)](https://github.com/thePlannerIvan/Planners-Proposal-System/actions/workflows/validate.yml)

**拿着零散 Brief 和调研材料，和 AI 一起磨出靠谱的策略判断，并生成一张在线可拖拽、可直接改字批注的 Storyline 提案工作台。**

> 作者：阿祖不看 TVC（小红书同名）· [demyth.info](https://demyth.info) · [Lawyif@163.com](mailto:Lawyif@163.com)

---

## 一句话看懂：它卡在整条链的哪一步

写商业提案最怕“资料还没消化明白、策略方向还没和人达成共识，AI 就迫不及待开始写长篇正文和画 PPT”。

**Planners Proposal System** 专门负责**动笔之前“想清楚、排顺逻辑”这一半**——不急着堆字数，而是帮你产出一张**“每页一句完整主张 + 两三条支撑判断”的可编辑 Storyline 主线**，确认后再交给下游展开：

```text
零散 Brief / 研究资料 / 访谈或数据结论
  → 1. 读懂材料、登记来源（哪部分没读到老实标注）
  → 2. 高摩擦讨论（挑刺、比取舍、按需查 Method Wiki 方法库）
  → 3. 组织有推进感的 Storyline（一页一句主张 + 支撑判断）
  → 4. 打开 Storyline 工作台：在线改字 / 拖曳调页序 / 局部批注修改
  → 交付给上游接力：交给 planners-bypage 扩写成完整逐页稿
```

*(需要继续生成逐页 PPT 正文与配图时交给 [`planners-bypage`](https://github.com/thePlannerIvan/planners-bypage)，需要直接出可编辑 PPTX 交给 [`planners-ppt-hell`](https://github.com/thePlannerIvan/planners-ppt-hell)。)*

---

## 你具体会拿到什么工作台体验？

完成讨论后，它不会只丢给你一串 Markdown 大纲，而是直接打开一个**实时交互的 Storyline 工作台**（支持 DSH 侧栏，没有 DSH 也能在本地浏览器打开）：

- **直接改字 & 拖曳排序**：每行就是一页 PPT 的核心主张，点开即可直接改标题、用回车增删下方支撑要点、鼠标拖曳或按 `Alt + ↑/↓` 调换页序，**编辑全程自动保存，带历史版本可随时恢复**；
- **行内精准唤改**：只想让 AI 重写某一页？点那一行右侧批注，单独提交那一页意见；双方同时改到同一页时会标出冲突提示，绝不静默覆盖你的手稿；
- **拒绝“目录占位符”**：每一页产出的是真判断而不是废话栏目名——

| 常见的无效栏目占位 | Proposal 交付的 Storyline 主张（示例） |
| --- | --- |
| “消费者洞察” / “放一张调研图” | **“增长的优先任务，是降低新客首次选择的难度。”**<br>• 新客难以区分产品，选择障碍集中在首次购买前<br>• 现有沟通强调参数，未对应具体使用场景<br>• 因此应先按场景组织推荐，再展开性能优势 |

---

## 什么时候选我 vs 选别的 Skill

| 你的当下需求 | 用哪个 Skill | 分工 |
| --- | --- | --- |
| 有 Brief 和参考资料，要先讨论策略方向、排出能说服人的 PPT 主线结构 | **本 Skill (`planners-proposal-system`)** | 只盯“策略判断 + 主线结构 + 可编辑 Storyline” |
| 已经有确认的主线，或只需直接把一堆资料写成完整逐页正文、配图并核查数字 | [`planners-bypage`](https://github.com/thePlannerIvan/planners-bypage) | 负责把每页主张扩写成完整可见文案、配图和事实审计 |
| 手上只有个单点业务矛盾卡点，只想跟 AI 讨论出破局洞察，还不到排 PPT 的阶段 | [`sparkling`](https://github.com/thePlannerIvan/sparkling) | 轻量高摩擦单点研讨（Proposal 内部讨论阶段也会自动调用它） |

---

## 快速开始与安装

### 1. DSH 用户（推荐）

通过 [Planners Form](https://github.com/thePlannerIvan/planners-form) 在 DSH 设置里勾选 `planners-proposal-system` 一键安装（会连同配套协同组件一起装好）。

### 2. Codex / Claude Code 用户

```bash
npx skills add https://github.com/thePlannerIvan/Planners-Proposal-System --skill planners-proposal-system
```

或克隆到本地 Skill 目录：

```bash
git clone https://github.com/thePlannerIvan/Planners-Proposal-System.git ~/.codex/skills/planners-proposal-system
# 或
git clone https://github.com/thePlannerIvan/Planners-Proposal-System.git ~/.claude/skills/planners-proposal-system
```

### 3. 直接这样开始

```text
使用 $planners-proposal-system 完整阅读这个项目目录里的 Brief 和调研资料：
先帮我理清核心矛盾与策略取舍，再组织出 Storyline 打开审阅台让我修改。
```

### 运行时依赖与配套能力

- **环境要求**：Node.js 20+。有 DSH 时直接挂入侧栏（配合 `dsh-review-dock`），没有 DSH 时由审阅底座在本地浏览器拉起同一页面。
- **公共底座（缺了会自动拉取至 `~/.planners-modules/`）**：
  - [`planners-review-core`](https://github.com/thePlannerIvan/planners-review-core) —— Storyline 自动保存工作台与双宿主运行底座
  - [`planners-source-index`](https://github.com/thePlannerIvan/planners-source-index) —— 资料来源路径与未读盲区账本
  - [`planners-method-wiki`](https://github.com/thePlannerIvan/planners-method-wiki) —— 按具体问题检索策略视角与论证配方
- **按需协同的同伴 Skill**（当前环境已安装时自动衔接）：[`sparkling`](https://github.com/thePlannerIvan/sparkling)（研讨）、[`storytelling`](https://github.com/thePlannerIvan/storytelling)（叙事动量）、[`slide-copy`](https://github.com/thePlannerIvan/slide-copy)（标题链表达）、[`planners-fact-check`](https://github.com/thePlannerIvan/planners-fact-check)（事实变动的按需复核）。

---

<details>
<summary>开发者说明：环境变量、工作产物、目录结构与本地验收（普通用户可忽略）</summary>

### 活动工作区文件

工作过程会在项目下生成 `<Project>/.proposal-work/` 活动目录，交付下游 `planners-bypage` 时直接复用同一批文件：
- `project-memory.md`：项目理解、收敛判断、用户决定与采用方法记录
- `source-index.json`：来源定位、阅读覆盖与盲区清单
- `page-architecture.json`：当前唯一 3.0 格式 Storyline（供 `planners-bypage` 默认直读）

### 公共模组解析顺序与离线控制

适配器（`proposal-co-creation/scripts/lib/planners-modules.mjs`）按以下顺序优先使用本地模组：
`$PLANNERS_MODULES_HOME/<名>` → `<skills-root>/<名>` → `02-skills-library/<分类>/<名>` → 自动安装至库外用户目录（`$PLANNERS_MODULES_INSTALL_DIR` → `$PLANNERS_MODULES_HOME` → `~/.planners-modules/`）。

- 设 `PLANNERS_NO_AUTO_INSTALL=1` 可禁止自动联网安装；设 `PLANNERS_MODULES_REF` 可锁定分支/tag。
- 旧 `proposal-library-maintenance/scripts/query-wiki.mjs` 仅保留作兼容转发，不再内置方法库。

### 本地校验与目录结构

```bash
npm ci && npm test
node --test proposal-co-creation/scripts/lib/planners-modules-install.test.mjs

# 校验与单独打开工作台
node proposal-co-creation/scripts/validate-page-architectures.mjs "<Project>/.proposal-work/page-architecture.json" --ready
node proposal-co-creation/scripts/start-page-review.mjs --architecture "<Project>/.proposal-work/page-architecture.json" --review-dir "<Project>/.proposal-work/reviews/structure"
```

```text
planners-proposal-system/
├── SKILL.md
├── agents/
├── proposal-co-creation/   # 3.0 主线契约、工作台生成与模块适配器
├── evals/                  # Storyline 编辑、版本与下游交接回归测试
└── package.json
```

</details>

---

## 品牌边界、开源协议与商业合作

- **许可协议**：以 [GNU Affero General Public License v3.0](LICENSE) 开源发布，可商业使用，修改版或网络服务须公开对应源码。
- **署名边界**：过程文档与工作台保留来源识别，默认不得写入客户最终提案、PPT 或交付文档；修改与 fork 规范见 [TRADEMARK.md](TRADEMARK.md)，归属声明见 [NOTICE](NOTICE)。
- **商业支持**：私有部署、企业提案流定制或闭源授权，请联系 `Lawyif@163.com` 或访问 [demyth.info](https://demyth.info)，详见 [COMMERCIAL.md](COMMERCIAL.md)。

## 相关项目

- [Planners Bypage](https://github.com/thePlannerIvan/planners-bypage) —— 接收 Storyline 展开完整逐页文案与配图
- [Planners Method Wiki](https://github.com/thePlannerIvan/planners-method-wiki) —— 可复用策略方法库（11 大模块）
- [Sparkling](https://github.com/thePlannerIvan/sparkling) / [Storytelling](https://github.com/thePlannerIvan/storytelling) / [Slide Copy](https://github.com/thePlannerIvan/slide-copy)
