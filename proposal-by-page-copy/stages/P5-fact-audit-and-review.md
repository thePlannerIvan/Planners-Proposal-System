# P5 最终事实审计、完整审阅与交付

## 本阶段目的

冻结当前逐页文案，只核对客户最终能够看到的数字事实。脚本完成覆盖、回源、数值匹配、简单计算和增量恢复；模型只处理真正需要理解的数字性质与语义口径。机器无法完成但来源明确的少数项目随终稿一起提交用户判断，不得因此卡死审阅。

## 第一步：冻结终稿并运行单一审计入口

先停止继续润色文案，再运行：

```bash
node "<Planners-Proposal-System 目录>/proposal-by-page-copy/scripts/audit-final-copy.mjs" \
  --mode prepare \
  --copy "<project>/.proposal-work/proposal-draft.md" \
  --source-index "<project>/.proposal-work/source-index.json" \
  --materials "<project>/.proposal-work/page-material-packs.json" \
  --source-root "<source-index 中相对路径对应的根目录>" \
  --audit "<project>/.proposal-work/fact-audit.json"
```

脚本扫描每页客户可见的标题与 `Page Content`，不扫描 Frontmatter 的内部判断和 `Production Notes`。它会：

- 枚举全部数字、比例、金额、时间、样本量、表格值和计算结果；
- 以完整事实陈述为审阅单位，同时分别记录其中每个数字；
- 优先复用本页材料包的来源 ID、定位与原文切片；
- 回到 `source-index.json`中的真实路径检查文件和数值；
- 直接读取 Excel 的全部工作表、单元格坐标和值；旧 `.xls` 先由脚本调用 LibreOffice 转换后读取。若环境为转换请求一次执行权限，应授权这条审计命令继续运行，不把“打开 Excel”交给模型；
- 归一化千分位、全半角、单位、万/亿、百分数和区间；
- 识别明显的页内编号与产品型号；
- 文案重跑时继承完全未变化的判断，对变化项只保留可复用来源线索并重新核对；
- 输出紧凑的 `.proposal-work/fact-audit-review-queue.json`，其中只含阻塞项、模糊项和每条事实最多两个去重后的候选证据切片；模型不需要阅读完整审计文件或重新寻找全部数字。

若 `page-material-packs.json` 不存在、为空或没有覆盖全部页面，脚本必须立即停止并返回 P2。不能在失去逐页取材上下文后，靠全库数字碰撞猜来源。

不得在运行审计后继续改文案；确需修改时，修改完成后重新运行同一条命令。脚本会增量恢复，不应手工复制旧结果。

不要用 Python 或临时批处理脚本修补 `fact-audit.json`。机械字段由审计脚本生成；批量写相同说明、相同来源或相同公式会制造假通过。

### 来源层级

来源要与数字的生成层级一致，不是一律追到最原始文件：

- 原始表中直接存在的单条记录、预算、日期和字段值，回原始表；
- 分析报告中已经明确写出的样本量、统计对象、占比、均值、增幅或词频，报告本身就是该汇总数字的直接来源；
- 报告由 500 条 CSV 计算出 `42.2%` 时，不要求脚本在 500 行元数据里逐字找到 `42.2%`；
- 报告由评论原文计数得到“136 次”时，只要报告清楚说明语料与口径，不要求模型重新逐句计数；
- 若报告只写结论、没有数字、对象或口径，不能借报告名义通过。

分析报告通过数值与语义定位后，按普通 `sourced_fact` 处理。不要同时强迫模型填写原始 Sheet、报告页码、逐行计数说明和重复的核对笔记。

## 第二步：只处理短队列，不直接修补审计文件

审计只使用四种数字性质：

- `sourced_fact`：来自 Brief、报告、表格、研究或客户资料；
- `derived_fact`：由来源数字计算出来的比例、倍数、合计或变化；
- `proposal_value`：方案提出的目标、预算建议、节奏、数量或假设；
- `non_factual`：步骤编号、季度编号、产品型号等不承担事实含义的数字。

脚本只在数值、局部语法和来源语境足够明确时预填；不能确定就保留为待判断，不为追求“自动通过率”猜测。一个表格行可以同时包含来源事实和方案目标，因此性质写在每个数字上，不给整句话强行只标一种类型。

模型只读取 `fact-audit-review-queue.json`。对每条模糊事实只做一个决定：

- `verified`：候选证据、数字语义和文案一致；
- `qualified`：数字是建议、目标、假设，或必须带限定才能成立；
- `fix_required`：当前文案有事实风险，先改文案，再重新 `prepare`；
- `user_review_required`：来源真实、风险已说清，但机器和模型都不能可靠裁决，提交用户明确决定。

底线不是“所有数字必须被机器自动通过”，而是“任何尚有事实错误风险的数字都不能悄悄进入终稿”。能算错、能找错来源、来源缺失的项目必须修；只有无法消除的语义边界才能提交用户。

把决定写入一个小文件，不直接编辑庞大的 `fact-audit.json`：

```json
{
  "contract_version": "fact-audit-decisions/1.0.0",
  "copy_sha256": "<从 review queue 原样复制>",
  "decisions": [
    {
      "fact_id": "<待办事实 ID>",
      "status": "verified",
      "note_zh": "指标、对象、时间与来源一致",
      "items": [
        {
          "token_id": "<待办数字 ID>",
          "kind": "sourced_fact",
          "source_id": "<候选来源 ID>"
        }
      ]
    }
  ]
}
```

只写发生判断的字段。来源优先从队列给出的候选中选择；复杂衍生关系确有必要时才补 `derivation`。不要写 `fingerprint`、Hash、机械状态、命中数组或 `carry_state`。

保存为 `.proposal-work/fact-audit-decisions.json`，然后由脚本合并并重新回源：

```bash
node "<Planners-Proposal-System 目录>/proposal-by-page-copy/scripts/audit-final-copy.mjs" \
  --mode resolve \
  --copy "<project>/.proposal-work/proposal-draft.md" \
  --audit "<project>/.proposal-work/fact-audit.json" \
  --decisions "<project>/.proposal-work/fact-audit-decisions.json"
```

脚本拒绝过期决定、未知事实、伪造候选来源和通过改类型绕过计算，并重新生成短队列。然后运行一次 `--mode confirm`，它只自动确认没有风险信号的低风险项，不替模型确认模糊项。

```bash
node "<Planners-Proposal-System 目录>/proposal-by-page-copy/scripts/audit-final-copy.mjs" \
  --mode confirm \
  --copy "<project>/.proposal-work/proposal-draft.md" \
  --audit "<project>/.proposal-work/fact-audit.json"
```

### 来源事实

确认指标、对象、样本、时间、地域、单位和分母一致。脚本找到同样的数字不代表语义相同；来源结论更弱时，降低文案强度并写明限定。

### 衍生事实

加减乘除、同句合计和连续区间计数优先由脚本推断并复算。只有脚本无法理解的复杂衍生关系才填写：

```json
{
  "operands": [185.6, 11.6],
  "operator": "divide",
  "displayed_value": 15,
  "comparison": "at_least",
  "tolerance": 0.1
}
```

`operator`只使用 `add`、`subtract`、`multiply`、`divide`或脚本支持的 `inclusive_range_count`；`comparison`使用 `equal`、`at_least`或`at_most`。来源中不必直接出现计算结果，但输入必须来自同一条可见事实且口径一致。公式算错是硬错误，不能提交用户代替计算。

### 方案数字

事实整体标为 `qualified`，并说明它是建议、目标或假设。若页面把建议写成历史事实，先修改文案再重跑。

### 脚本无法完成的例外

普通 Excel 不是例外，必须由脚本读取。例外只包括加密或损坏文件、扫描图片、无法提取的图表，以及确实需要重新定义统计口径才能重算的内容。模型应先寻找已经明确写出统计结果、对象与口径的分析报告；仍无法可靠裁决时，保留真实来源并标为 `user_review_required`。不要编造 Sheet、页码或核对说明。

## 第三步：语义核对

对每条事实只判断：

- 数字在说哪个指标、对象和样本；
- 时间、地域、单位、分母与统计口径是否一致；
- 表格列和图表关系有没有错位；
- 原话或结论是否被断章取义；
- 衍生数字是否使用了正确输入；
- 方案数字是否清楚表达为建议；
- 结论强度是否超过来源。

状态：

- `verified`：来源与语义一致；
- `qualified`：成立，但需要保留限定，或该条包含明确的方案数字；
- `fix_required`：当前文案不能通过，必须修改后重跑。
- `user_review_required`：不存在已知硬错误，但剩余不确定性只能由用户决定；必须用一句话说明用户要判断什么。

同一个事实在标题和正文重复时仍需确认两个表达是否一致，但来源定位可以继承。不要为了减少条目而把不同指标、不同对象的相同数字合并。

## 第四步：脚本复算并阻断

运行：

```bash
node "<Planners-Proposal-System 目录>/proposal-by-page-copy/scripts/audit-final-copy.mjs" \
  --mode check \
  --copy "<project>/.proposal-work/proposal-draft.md" \
  --audit "<project>/.proposal-work/fact-audit.json"
```

检查会重新读取当前终稿、来源索引和真实来源文件，不相信 JSON 中手写的机械状态。它把结果分为：

- `valid: true`：全部机械与语义核验完成；
- `reviewable: true`、`requires_human_review: true`：没有硬错误，但存在来源明确、机器无法最终确认的事实例外，可以启动终稿审阅；
- `reviewable: false`：仍有未分类数字、来源文件缺失、语义待修或计算错误，必须先修复。

事实例外不是自动放行。终稿审阅页会取消对应页面的默认通过，展示数字、陈述、原因与来源，用户必须明确选择“接受事实例外并通过”或“需要修改”。

## 第五步：自动打开终稿审阅

```bash
node "<Planners-Proposal-System 目录>/proposal-by-page-copy/scripts/start-copy-review.mjs" \
  --copy "<project>/.proposal-work/proposal-draft.md" \
  --audit "<project>/.proposal-work/fact-audit.json" \
  --review-dir "<project>/.proposal-work/reviews/final" \
  --final-md "<project>/deliverable/proposal.md" \
  --kind final \
  --port 0
```

不要询问是否需要网页。告诉用户保存后回到 Codex 发送“已完成”，然后结束当前回合。

## 用户返回后

1. 检查反馈真实存在并绑定当前文案和事实审计；
2. 明确回复已收到；
3. 有修改项则修改文案，重新运行 `prepare`、语义核对和 `check`，再打开审阅；
4. 整体批准后运行：

```bash
node "<Planners-Proposal-System 目录>/proposal-by-page-copy/scripts/build-reviewed-copy.mjs" \
  --copy "<project>/.proposal-work/proposal-draft.md" \
  --audit "<project>/.proposal-work/fact-audit.json" \
  --feedback "<project>/.proposal-work/reviews/final/review-feedback.json" \
  --output "<project>/deliverable/proposal.md" \
  --assets-dir "<project>/deliverable/assets"
```

## 完成标准

- 所有客户可见数字进入审计；
- 来源事实已定位真实来源并完成语义核对；
- 衍生事实可复算；
- 方案数字明确表达为建议、目标或假设；
- 产品型号和结构编号没有被误当成事实；
- 分析报告中的汇总数不再被错误要求回到原始明细逐字匹配；
- 机器无法核实但来源明确的少数事实已由用户显式决定；
- 来源缺失、未分类和计算错误仍然阻断；
- 文案修改只重查变化事实；
- 当前终稿通过脚本复算后才打开最终审阅；
- 用户批准的版本与最终交付完全一致。
