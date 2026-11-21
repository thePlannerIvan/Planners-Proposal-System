# Planners Proposal

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Tests](https://github.com/thePlannerIvan/planners-proposal/actions/workflows/validate.yml/badge.svg)](https://github.com/thePlannerIvan/planners-proposal/actions/workflows/validate.yml)

**拿着零散 Brief 和调研材料，和 AI 一起磨出靠谱的策略判断，并生成一张在线可拖拽、可直接改字批注的 Storyline 提案工作台。**

> 作者：阿祖不看 TVC（小红书同名）· [demyth.info](https://demyth.info) · [Lawyif@163.com](mailto:Lawyif@163.com)

---

## 一句话看懂：它卡在整条链的哪一步

写商业提案最怕“资料还没消化明白、策略方向还没和人达成共识，AI 就迫不及待开始写长篇正文和画 PPT”。

**Planners Proposal**（原 `planners-proposal-system`）专门负责**动笔之前“想清楚、排顺逻辑”这一半**——不急着堆字数，而是帮你产出一张**“每页一句完整主张 + 两三条支撑判断 + 来源出处”的可编辑 Storyline 主线**，确认后再交给下游展开：

```text
零散 Brief / 研究资料 / 访谈或数据结论
  → 1. 读懂材料、轻量登记来源（source-index/2.1.0，标清 provenance 与盲区）
  → 2. 高摩擦讨论（sparkling 研讨、Method Wiki 查框架、storytelling 排叙事、slide-copy 磨主张）
  → 3. 生成 .planners/storyline.md（一页一句主张 + 支撑判断 + 末尾 > 出处）
  → 4. 打开实时工作台（DSH 侧栏 / 本地浏览器）：在线改字 / 拖曳调页序 / 块级批注修改
  → 5. 定稿后交给 planners-bypage 扩写成可编程 PPT 的完整逐页稿并做全面事实核查
```

*(需要继续生成逐页 PPT 正文与全面核查交给 [`planners-bypage`](https://github.com/thePlannerIvan/planners-bypage)，需要直接出可编辑 PPTX 交给 [`planners-ppt-hell`](https://github.com/thePlannerIvan/planners-ppt-hell)。)*

---

## 你具体会拿到什么工作台体验？

完成讨论后，它不会只丢给你一串 Markdown 大纲，而是把主线写成一份 `.planners/storyline.md`，再打开**实时交互的 Storyline 工作台**（DSH 侧栏直接展示，或本地浏览器服务）：

- **直接改字 & 拖曳排序**：每一页就是一条主线判断，点开即可改主张、用回车增删支撑要点、拖块首手柄或页标题调整顺序、按 `Alt + ↑/↓` 移动，**编辑全程自动保存，带历史版本可随时恢复**；
- **感知你的手工重排（`task.diff`）**：如果你自己增删或拖拽调整了页面，下次提意见给 AI 时，工作台会自动附上结构差异，不让 AI 把旧顺序覆盖回来；
- **块级精准唤改**：只想让 AI 重写某一块？选中它或点块尾批注按钮，单独提交那块意见；双方同时改到同一块时会标出待核对，绝不静默覆盖你的手稿。

---

## 什么时候选我 vs 选别的 Skill

| 你的当下需求 | 用哪个 Skill | 分工 |
| --- | --- | --- |
| 有 Brief 和参考资料，要先讨论策略方向、排出能说服人的 PPT 主线结构 | **本 Skill (`planners-proposal`)** | 只盯“策略判断 + 主线结构 + 可编辑 Storyline + 轻量来源出处” |
| 已经有确认的主线，或只需把资料写成适合编程 PPT 的完整逐页文案与全面事实核查 | [`planners-bypage`](https://github.com/thePlannerIvan/planners-bypage) | 负责把每页主张扩写成完整逐页正文、配图并执行独立 `planners-fact-check` |
| 只需要单点业务研讨出洞见，还不到排 Storyline 的阶段 | [`sparkling`](https://github.com/thePlannerIvan/sparkling) | 轻量高摩擦单点研讨（Proposal 讨论阶段会自动协同） |

---

## 快速开始

```text
使用 $planners-proposal 完整阅读这个项目目录里的 Brief 和调研资料：
先帮我理清核心矛盾与策略取舍，把 Storyline 写成 storyline.md，再打开工作台让我多轮打磨。
```

### 运行时依赖与配套能力

- **环境要求**：Node.js 20+。
- **公共底座（缺了会自动拉取至 `~/.planners-modules/`）**：
  - [`planners-review-core`](https://github.com/thePlannerIvan/planners-review-core) —— `planners-doc/2` 文字工作台（`doc-surface` + `doc-command` / `doc-workbench` + `doc-inbox`）与 `task.diff` 底座
  - [`planners-source-index`](https://github.com/thePlannerIvan/planners-source-index) —— 来源定位、可信度 `provenance` 与未读盲区台账
  - [`planners-method-wiki`](https://github.com/thePlannerIvan/planners-method-wiki) —— Karpathy LLM Wiki Markdown 方法库
- **按需协同的同伴 Skill**：[`sparkling`](https://github.com/thePlannerIvan/sparkling)（研讨）、[`storytelling`](https://github.com/thePlannerIvan/storytelling)（叙事动量）、[`slide-copy`](https://github.com/thePlannerIvan/slide-copy)（标题链与页面文案）、[`planners-fact-check`](https://github.com/thePlannerIvan/planners-fact-check)（核心数据改动按需复核）。

---

<details>
<summary>开发者说明：工作区文件、校验与测试</summary>

活动工作区目录为 `<Project>/.planners/`：
- `storyline.md`：唯一 Storyline 工作稿（`planners-doc/2`）
- `project-memory.md`：收敛判断、取舍边界与采用的 Method Wiki `lens_id`
- `source-index.json`：轻量来源台账（`source-index/2.1.0`）

旧 `.proposal-work/page-architecture.json` 在工作台中只读展示，不迁移。

```bash
npm test
node --test scripts/lib/planners-modules-install.test.mjs

# 校验与打开工作台
node scripts/validate-storyline-doc.mjs "<Project>/.planners/storyline.md"
node "<planners-review-core>/scripts/doc-workbench.mjs" "<Project>/.planners/storyline.md" --open
```

</details>

---

## 品牌边界、开源协议与商业合作

- **许可协议**：[GNU Affero General Public License v3.0](LICENSE)。
- **署名边界**：过程文档与工作台保留来源识别，默认不得写入客户最终提案或 PPT；详见 [TRADEMARK.md](TRADEMARK.md) 与 [NOTICE](NOTICE)。
- **商业支持**：联系 `Lawyif@163.com` 或访问 [demyth.info](https://demyth.info)，详见 [COMMERCIAL.md](COMMERCIAL.md)。
