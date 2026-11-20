# Storyline 工作稿格式

新项目的 Proposal 主线只有一份工作稿：`<Project>/.planners/storyline.md`。它是一份普通的 `planners-doc/2` 文档，结构由 `planners-review-core` 的 `contracts/planners-doc.md` 定义；本文件只规定 Proposal 怎么把判断写进去，以及提案自己的两条校验规则。

- 模板：[`proposal-co-creation/templates/storyline.md`](../templates/storyline.md)
- 真实样例：[`evals/fixtures/labbrand-storyline.md`](../../evals/fixtures/labbrand-storyline.md)（朗标笔试案，5 章 10 页）
- 校验：`proposal-co-creation/scripts/validate-storyline-doc.mjs`

## 1. 文档头

第一行必须是 `---`，三个字段，再用 `---` 收口：

```md
---
contract: planners-doc/2
doc: storyline
project: 朗标笔试案
---

# 一、判断
```

| 字段 | 值 |
|---|---|
| `contract` | 固定 `planners-doc/2` |
| `doc` | 固定 `storyline` |
| `project` | 项目名，非空。**它就是文档名**，工作台用它显示「这是哪份稿」 |

字段写法、闭合、重复与未知字段的处理跟随 `planners-doc/2`；这里不加第二个文档头。正文里不再写文档标题行：文件头之后的第一条结构就是 `#` 章节。

## 2. 层级

| 写法 | 是什么 |
|---|---|
| `#` | 章节 |
| `##` | 页，交付时的「一屏」 |
| `###`–`######` | 标题块，按层级出字号；提案用它写页内标题块 |

页号由顺序决定，不写进正文；页与页之间不加分隔线。内容块必须写在某个 `##` 页里，直接挂在 `#` 章节下的块会被拒绝。

## 3. 每页怎么写

一页 = 一句主张 + 两三条支撑。主张用段首标记 `主张：`，支撑用列表项，都写在页内第一个标题块之前：

```md
## 新品类叫「植物节律液」，卖的是状态切换

主张：定义新品类「植物节律液」，以 150ml 浓缩形态锚定「调整状态」。

- 品类核心是调整身心状态，不是售卖单一功能。
- 150ml 与 15 元对应的是状态切换，不是解渴容量。
- 三大系列各自替掉一个更差的选择：咖啡、旧式运动饮料、褪黑素。

### 依据与边界
- 15 元定价是工程报告的成本推算，未做真实价格测试。

> 思路大纲 P05（2026-11-13）。
```

规则：

- **一句主张**：页内只能有一处段首 `主张：`，且写在支撑之前。它代替了旧 JSON 里的 `claim` 字段。
- **至少一条支撑**：页内至少一个列表项，写在第一个标题块之前。只有一条或超过四条时校验器给警告，不阻断；两三条是写作指引。
- **页内标题块不算主张与支撑**：`### 依据与边界` 之后的列表项既不算支撑，也不参与条数。用什么标题、分几级由作者定，契约不给它特殊语义。
- **页末出处**：依据与来源写成页末连续的引用（`> …`），位置就是语义；页中段的引用照常显示、不算出处。出处条数不设限，有没有出处由作者判断。
- **不手写锚点**：块身份（`<!-- b:xxxxxx -->`）由工作台首次打开时补写。手写容易重复，重复锚点会被拒绝。
- **不写页号、不写栏目名**：`消费者分析 / 沟通问题 / 优化建议` 是栏目名；`放一张调研图` 是取材任务。两者都不能替代支撑判断。

## 4. 校验

```bash
node proposal-co-creation/scripts/validate-storyline-doc.mjs "<Project>/.planners/storyline.md"
node proposal-co-creation/scripts/validate-storyline-doc.mjs "<Project>/.planners/storyline.md" --text
```

它先调用 `planners-review-core/scripts/validate-doc.mjs` 完成结构校验（文档头、章节 / 页 / 标题块层级、锚点、图片、空页、页末出处），再用同一个切块实现 `lib/doc-blocks.mjs` 读页与块，加上提案规则。**没有第二套解析器。**

退出码：

| 码 | 含义 |
|---|---|
| `0` | 合规（可有警告） |
| `1` | 不合规：至少一个错误 |
| `2` | 用法、文件或依赖错误 |

JSON 回执沿用公共校验器的形状，`checked` 额外给出 `claims` 与 `supports`：

```json
{
  "contract": "planners-doc/2",
  "valid": false,
  "errors": [
    {
      "code": "page_support_missing",
      "message": "每页至少一条支撑：用列表项说明主张为什么成立",
      "line": 92,
      "page": "章节「三、品类与产品」第 2 页「用工程链把「有效」做成可交付」",
      "block": "第 1 块（段落）"
    }
  ],
  "warnings": [],
  "checked": { "doc": "storyline", "chapters": 5, "pages": 10, "claims": 10, "supports": 30 }
}
```

提案加的错误码：

| 码 | 什么时候 |
|---|---|
| `doc_kind` | 文档头的 `doc` 不是 `storyline`：这套规则只检查主线 |
| `page_claim_missing` | 页内没有以 `主张：` 开头的段落 |
| `page_claim_empty` | `主张：` 后面没有内容 |
| `page_claim_multiple` | 一页出现两处及以上 `主张：` |
| `page_claim_after_support` | 主张写在支撑之后 |
| `page_support_missing` | 页内没有列表项支撑 |

提案加的警告（不阻断）：`page_support_single`（只有一条支撑）、`page_supports_many`（超过四条，考虑拆页）。

## 5. 工作台

```bash
node "<planners-review-core>/scripts/doc-workbench.mjs" "<Project>/.planners/storyline.md" --open
```

工作台按块读出文档、就地编辑、自动保存；只替换被改块的 raw，未编辑的块逐字保留。第一次打开会补写缺失锚点，这是正常落盘，不是内容改动。块级反馈与待核对的规则见 `planners-review-core/contracts/planners-doc-task.md`，Proposal 侧的启动与处理见 [工作台操作](../../references/workbench.md)。

## 6. 与旧 JSON 主稿的关系

旧 `page-architecture.json`（2.0 / 3.0）不再是新项目入口，不迁移、不兼容改写；工作台可以只读打开它，写入口一律拒绝。

| 旧 JSON | 新文档 |
|---|---|
| `project_id` | 文档头的 `project`（文档名只在这里） |
| `storyline_thesis` | 第一章第一页的主张 |
| `sections[].title` | `#` 章节 |
| `pages[]` 顺序 | `##` 页的顺序，页号不写进正文 |
| `claim` | 段首 `主张：` |
| `supports[]` | 列表项支撑 |
| `notes` | 页内一个标题块（如 `### 依据与边界`），或写进支撑 |
| `page_number`、`section_id` | 不再由人维护：页序、章节归属由位置决定 |

## 7. 它不做什么

- 不评价判断对不对、结构顺序好不好、来源可不可信。
- 不检查支撑条数是否「好看」：只有一条或很多条都给警告，交给人决定。
- 不替代工作台的保存后校验：文件被直接改过之后，先跑校验器再重新打开工作台。
