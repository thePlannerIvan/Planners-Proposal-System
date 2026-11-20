# Storyline 工作台操作

适用于打开 `.planners/storyline.md`、处理块级反馈与待核对。文档怎么写见 [文档形态](../proposal-co-creation/contracts/storyline.md)；结构权威是 `planners-review-core/contracts/planners-doc.md`，任务形状是 `planners-review-core/contracts/planners-doc-task.md`。

`<C>` 为本 Skill 的 `proposal-co-creation/scripts`，`<K>` 为 `planners-review-core` 根目录，`<D>` 为当前 `storyline.md` 的绝对路径。

## 先校验，再打开

```bash
node "<C>/validate-storyline-doc.mjs" "<D>"
node "<K>/scripts/doc-workbench.mjs" "<D>" --open
```

- 校验失败先修文档，不带错打开。
- `--open` 在本地打开浏览器；DSH 里把工作台 URL 交给用户。工作台是本地 loopback 服务，不是一份 `review-surface.json`。
- 第一次打开会补写缺失锚点并落盘。锚点是块身份，不是内容改动；重复锚点会重建。
- 打开后用 `GET /api/doc` 确认真的读出了页与块：回执里有 `contract` / `doc` / `project` / `sha256` / `pages` / `blocks` / `repairs` / `errors`。进程起来不等于工作台读对了文档。
- 工作台是长驻进程：启动后不要等它退出，也不要在人操作期间轮询；人回来说改完再继续。

## 人在工作台里怎么改

- 左侧目录按「章节 → 页」两级，点页跳转，滚动高亮当前页。
- 点任意块直接改；回车分块，删空合并；拖块首六点句柄移块，拖页标题移整页，也可 `Alt+↑↓`。
- 自动保存，没有手动保存按钮；历史版本可查看与恢复，恢复是一次新编辑，旧记录不抹。
- 选中文字吸附到完整块；块尾批注、选中浮出按钮、顶部「整体反馈」（整页 / 整份）都能提交。提交是请求模型修改，不是保存，也不是批准。

## 模型接反馈

1. **有侧栏插件时**：插件唤醒模型。任务在 `GET /api/tasks`；`POST /api/task/claim` 锁定任务绑定的块，`POST /api/patch` 按锚点写回。回执里的 `deferred_blocks` 是进「待核对」的块，不覆盖任何一方。
2. **没有插件时**：任务落在文档同目录的 `.doc-workbench/inbox/`。人说完再读：

   ```bash
   node "<K>/scripts/doc-inbox.mjs" list "<D>"     # 未处理任务
   node "<K>/scripts/doc-inbox.mjs" take "<D>"     # pending → processing
   ```

   每条任务带块身份、提交时的内容指纹与人的意见原文。按任务里的锚点读文件、只改指定块。处理后重跑校验并重新打开工作台；收件箱不会因为文件被改就自动标记完成。
3. **工作台开着时只提交 patch**，不重写全文；**工作台没开时**可以直接编辑文件，下次打开以磁盘上的文档为准。
4. 处理前后核对任务里的块指纹。块已经不在文档里（`task_stale`）就不要硬改，请用户重新提交反馈。
5. 处理指定页时检查它和前后论证的衔接。策略取舍回到讨论；事实变动回查材料，必要时调用 `planners-fact-check`，不把主线检查当作完整稿核查。
6. 保存、派发、取走任务都不等于用户同意进入下游。

## 待核对

`GET /api/conflicts` 读每一块的两个版本，人用 `POST /api/conflict/decide` 选 `mine` / `model` / `discard`。三种裁决都解锁并删除这条待核对；不要替人决定。工作台会提示刷新，刷新前的编辑留在草稿里。

## 旧项目兼容（只读）

旧的 `.proposal-work/page-architecture.json` 也能用同一个工作台打开，但**只读**：顶部写明原因，保存、重排、派发都返回 `409 readonly`，磁盘一个字节都不动。旧项目不迁移；需要时按 `planners-doc/2` 重建 storyline.md。

旧 JSON 主稿流程的脚本保留在 `proposal-co-creation/scripts/`：`validate-page-architectures.mjs`、`start-page-review.mjs`、`review-inbox.mjs`、`validate-page-review-feedback.mjs`。只有恢复使用旧反馈提交的 2.0 项目时，才按顺序运行（`<R>` 是旧项目的审阅目录，`<A>` 是旧 `page-architecture.json` 的绝对路径）：

```bash
node "<C>/review-inbox.mjs" --review-dir "<R>"
node "<C>/validate-page-review-feedback.mjs" --feedback "<R>/review-feedback.json" --architecture "<A>"
```

新项目不用 inbox、legacy feedback 或 overall_decision 作为继续工作的批准门；兼容界面的提交机制不改变当前工作台的自动保存约定。
