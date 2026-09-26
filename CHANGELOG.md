# Changelog

## 2026-09-26 — 清理：退役 co-creation 的自带审阅宿主、删掉指向已删目录的 npm script

**起因**：一次「本地 vs 公开仓库」逐字节对齐时暴露出两处**配置/文件与代码不一致**的遗留 —— 都不是本次改造新引入的，是之前那次迁移没走完的尾巴。

- **退役 `proposal-co-creation/` 的自带审阅宿主**：`scripts/page-review-session.mjs`（167 行）与
  `scripts/lib/review-launcher.mjs`（48 行）。C4 上缝之后 `start-page-review.mjs` 已经 import
  `./review-surface-support.mjs`，这一对**没有任何调用者**（全 `02-skills-library` 范围 grep 只找到 launcher 引 session 这一条自引用）。
  **先归档再删**：原件移到 `02-skills-library/_archive/proposal-co-creation-review-host-retired-2026-09-26/`（附 README 说明原职责、取代者与血统）。
  注意：那次改造已归档过 `proposal-by-page-copy/` 里的**同名**两份，`proposal-co-creation/` 这一份当时漏了 —— 本轮补齐。
- **删掉失效的 npm script**：`"test:by-page-copy": "node evals/by-page-copy/run.mjs"`。该目录（逐页文案 P1–P5 那套）已退役，
  script 指向不存在的路径；`npm test`（`evals/run-all.mjs`）只跑 router / library / co-creation 三套，不受影响。
  同一份 `package.json` 其余 script 的目标文件已逐条验证存在。

> **`description` 仍是旧口径**：「从方法库维护、策略共创到逐页文案与事实审计的一体化提案 Skill」—— 逐页文案与事实审计已分别交给
> `planners-bypage` 与 `planners-fact-check`。本轮**只清路径级死引用**，未改 description 文案；要改请单独发话。

## 2026-09-26 — B4「方法库全量审阅」面接到公共缝上

**起因**：B4 是这套流程里**唯一**还自带审阅宿主的环节 —— 自己的 `review-session.mjs`、自己写原生反馈、
把提交直接 POST 到 `/save-feedback`，并且**强制**弹出浏览器（开不动就 `fail()` 终止整条命令）。
公共缝（`planners-review-core`）已经把宿主收走了，bypage 早一步删掉了自带宿主；B4 是同形的那一面。

- **上缝**：`B4/review/review-surface.json`（面 id `planners-proposal-system/library`）＋ 宿主注入的桥。
  入口只留一个裸着独占一行的 `{{REVIEW_BRIDGE}}`；页面**不再自带服务器、不认端口与路径、不放桥的副本**。
- **收件层**：页面把提交交给宿主落 `review-submissions.json`，`scripts/review-inbox.mjs` 把它翻译成原生
  `review-feedback.json`（**原生形状一个字段不动**），并报出原始记录里没有的字段。顺序被钉住：**先收件，再跑门**。
- **删掉自带宿主**：`scripts/review-session.mjs`。生命周期只有公共模组那一份（Node CLI）。
- **不再强制开浏览器**：`start-review-session` 默认开、`--no-open` 关，**开不了浏览器不是致命错误** ——
  宿主如实回 `opened:false` 就继续，页面照 serve、提交照收。
- **R11** 页首加了一个**永久可见**的刷新出口（`⟳`）—— 它不嵌在任何告警里，因为"页面 JS 变了、数据没变"这个场景
  不会产生告警，嵌在告警里就等于永远拿不到新页面。
- **R7** 页面**不再存状态**：删掉浏览器端草稿。上一轮的文字不预填、`defer`（这一轮先不动它）不变成下一轮的待办、
  一次点击即批准，**没有要人清空的东西**。顺带消掉一个真缺陷：不透明帧里顶层读本地存储会当场抛。
- **R10** 页脚加了「整体意见（不针对任何一个方法）」：不想挑任何一条方法时也能说一句"这批方法整体不对"。
  它走提交文件 + 唤醒（收据里有原文），**不改原生契约** —— 原生记录要求逐项决定，宁可空着也不替人补。
- **R5b** 页面知道、机器看不见的前提进数据：`pre_check`/`pre_check_note`（这一页有没有核对过审阅包）与
  整体意见一起由收件层摘进收据。
- **第一张行为网**：这一面此前**零行为覆盖**（17 条断言全是静态取模式，一条都没起过 session）。
  现在有同一张网两种模式（`--legacy` 跑冻结的改前代码 / `--seam` 跑当前代码）：基线 10 条两种模式都全绿，
  新增的 16 条上缝判据在 `--legacy` 上全红、在 `--seam` 上全绿。

**留下的两条契约缺口（本轮只记录，不改 schema）**：① `library-curation.schema.json` 比门更松（只要求字段存在），
curation 能过自己的 schema 却可能产出过不了门的 `edited_proposal`；② 页面默认发出去的 `edited_proposal`
就是 `item.proposal`，所以"只点批准"能不能过门取决于 curation 是否已经长成反馈的形状。
两条用**行为等价**钉住：上缝前后"只点批准"的原生记录逐字节相同。


## 2026-09-26 — 0.3.0（逐页文案交给 planners-bypage）

**起因**：本项目与 `planners-bypage` 各带一套逐页文案产线（P1–P5 vs bypage 的 05–08），以及同源的事实审计器（1013 / 1066 行）。同一条链上两份实现各自演化，就是缺陷的来源 —— 最明显的证据是两边的 Storyline 定义已经分叉，同一个下游会收到两种质量的结构。

- **退役** 整个 `proposal-by-page-copy/`（23 个文件）：P1–P5、四态事实审计器、审阅机械、`by-page-copy/2.0.0` 契约与模板。原件归档到 `02-skills-library/_archive/proposal-by-page-copy-retired-2026-09-26/`。
- **并入 bypage**（内容资产，不是机械）：`references/proposal-language.md`（提案页语言规范）与 `templates/copy-style-profile.md`（风格档案）。
- **改接**：本 Skill 产出 `page-architecture.json` + 结构审阅批准后，**交给 `planners-bypage`** 完成逐页文案、事实核查与终稿；交付物从 `deliverable/proposal.md` 改为 `deliverable/by-page.md`（由 bypage 产出）。
- **交付契约只剩一份**：bypage 的 `templates/by-page.md` 是本项目那份的超集，以它为准。
- **事实核查**由公共件 `planners-fact-check` 承担；**来源索引**用公共件 `planners-source-index` 的 `source-index/2.0.0`。

**分工判据**：本 Skill 管「客户必须依次接受哪些判断、每页证哪一句」；bypage 管「每页写什么、来源对不对、图用哪张」。

## 2026-09-13 — 0.2.0（Storyline 定义重写）

起因：一次 20 页实跑（项目在 `01-projects/某运动品牌世界杯项目/03_方案/`）产出的 Storyline 读起来像报告目录，而不像一条判断链。核对架构文件后确认：thesis 本身写得很好、就是答案，但**裁定前的 7 个 section 里 4 个以「看清……」开头，第一节是「先立口径」**——20 页的稿子准备用方法论开场，答案落在第 5 节的标题上。

定位到定义里的一句话：原文只给了「证明负担」这一个可操作检验，而证明负担是**向后看**的（我证明够了没有），它不问**向前看**的问题（客户读到这里，相信的东西从什么变成了什么）。于是生成过程退化成"把 thesis 拆成需要确立的几个事实"，写出来自然是目录。

- **Storyline 定义从「认知变化」改为「有信息量的判断链」**（`proposal-co-creation/WORKFLOW.md`、`stages/C3-storyline-page-architecture.md`、`contracts/page-architecture.md`）。新增三条此前缺失的约束：
  - **句式**：每个节点是一句有信息量的陈述句，让人看出因为什么、所以什么。动作句（「看清 X」）、流程句（「先立口径」）、修辞反转（「你以为／其实」）都不是节点。
  - **禁入**：方法与口径、数据边界、样本说明不占节点，它们是页内边界条或附录。
  - **递进**：后一个节点以前一个节点已经确立的判断为前提；连起来读应当是"因为……所以……"的推进，不是"第一……第二……第三"的并列。
- **页数规则从「论证完整性」改为「每一页的归属」**（`C3`、`WORKFLOW.md`、`contracts/page-architecture.md`）。「论证完整性」是无界的单向棘轮，只会把页数推高；新的判据是每一页都要能说出自己在证哪一句判断，说不清归属的页不该存在。
- **`stages/C4-structure-review.md` 提示审阅者先看判断链本身**，节点形式或禁入项不合规就在这里退回 C3，不等逐页文案写完再改。
- 完成标准同步更新（`C3` 与 `WORKFLOW.md` 各一处清单）。

未在本版处理：结构审阅与终稿审阅的反馈文件、逐页文案阶段的语言约束未做改动。

### 0.2.1 — 同日的 with/without 对照与三项修补

改完定义后，用**同一批材料重跑了一遍 C3**（隔离目录，未覆盖原项目产物），与改动前的基线逐节点比对。结论是**略有改善，不是明显更好**——这个结果值得原样记下来：

- 旧 section 标题实际就是旧 Storyline：判断句 0／动作句 3／流程句 4／修辞反转 0。
- 新结果 11 个节点：判断句 11／动作 0／流程 0／反转 0。三条禁入规则**确实生效且可逐条指认去向**：「先立口径」降为页内边界条＋附录（旧的两个整页消失），三个「看清…」被拆成带数字的判断句。
- 页数 20 → 13，块 77 → 47，**逐条核对没有证据被砍**；减少主要来自口径/边界退出占节。

但对照也暴露了三个新问题，其中第一个是我这次改动自身的缺陷：

- **F3（最严重）规则指向了不存在的载体。** 新规则写「方法与口径属于页内边界条**或附录**」，而 `contracts/page-architecture.md` 2.0.0 **根本没有附录字段**——实际只有页内一条路，结果 13 页里 9 页都挂着边界块，口径敏感性（原 P19）在新架构里无处落点。**已补 `pages[].boundary` 与 `appendix[]` 两个结构位。**
- **F1 节点膨胀。** 要求"有信息量"加上"每个数字必须带分母"，节点平均涨到 114 字、最长 154 字，变成了段落摘要。**已在 contract 与 C3 写明：节点是一句话，分子分母与样本量放页面上，不塞进节点句。**
- **F2 "有信息量"与"递进"互相拉扯。** 拆开则并列、合并则一句 159 字，定义没给取舍规则。**已写明取舍：宁可让节点长一点，也不要让链条变成并列清单；同一判断的多个证明面合并为一个节点、由多页分别证明。**

仍待观察（对照如实记录、本版未处理）：结论不再先行（方向页退到第 10 页）；部分节点仍有轻度「不是 A 而是 B」残留与可指认的强行因果包装；节点分类判据不可机械化。

## 0.1.0 — 初始版本

- Mode A（Brief 与资料 → 方向共创 → Storyline 与页面架构 → 逐页文案 → 事实审计 → Markdown 交付）与 Mode B（历史方案 → Method Wiki）双路线。
- 结构审阅、样页审阅、终稿审阅三次人机确认；事实审计绑定来源索引。
