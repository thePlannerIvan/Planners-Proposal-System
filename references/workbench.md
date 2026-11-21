# Storyline 工作台操作

适用于打开 `.planners/storyline.md`、识别人的结构修改（`task.diff`）并处理块级反馈与待核对。文档规范见 [文档形态](../contracts/storyline.md)；公共契约由 `planners-review-core` 的 `contracts/planners-doc.md`、`contracts/planners-doc-task.md`、`contracts/planners-doc-diff.md` 定义。

`<P>` 为本 Skill 根目录，`<K>` 为 `planners-review-core` 根目录，`<D>` 为 `<Project>/.planners/storyline.md` 的绝对路径，`<S>` 为 `<Project>/.planners/.doc-workbench/review-surface.json`。

## 1. 先校验，再按宿主模式打开

先跑提案校验，不带错打开：

```bash
node "<P>/scripts/validate-storyline-doc.mjs" "<D>"
```

- **DSH 侧栏模式（推荐，插件在场时）**：
  ```bash
  node "<K>/scripts/doc-surface.mjs" "<D>"
  ```
  生成 `.doc-workbench/review-surface.json` 后调用 `review_open` 打开侧栏标签。第一次打开会为缺锚点的块补写 `<!-- b:... -->` 并落盘。
- **本地独立宿主模式（无 DSH 插件时）**：
  ```bash
  node "<K>/scripts/doc-workbench.mjs" "<D>" --open
  ```
  工作台是本地 loopback 长驻服务：启动后用 `GET /api/doc` 验证已读出 `pages` / `blocks` 即可交出 URL，不在人编辑期间轮询。

## 2. 人在工作台里能做什么

- 左侧目录按「章节 → 页」两级跳转与高亮；可直接拖拽页标题或 `##` 块移动位置、按 `Alt+↑/↓` 调序。
- 点击任意块直接编辑；回车拆块、删空合并；所有编辑**自动保存（无手动保存按钮）**，且可随时恢复任意历史版本。
- 在块尾、选区浮窗或页面底部输入意见提交给 AI。提交触发改稿任务，不等于「批准进入下游」。

## 3. 模型如何接手反馈与 `task.diff`

1. **查看任务**：
   - DSH 侧栏：`node "<K>/scripts/doc-command.mjs" "<S>" tasks`
   - 本地宿主：`GET /api/tasks`（或无插件轮询时读 `.doc-workbench/inbox/`：`node "<K>/scripts/doc-inbox.mjs" list "<D>"` / `take "<D>"`）
2. **先看 `task.diff`（关键）**：自上次模型读稿以来，如果用户在工作台里手动新增了页、删除了页、跨章拖拽或修改了结构，`task` 会携带结构差异摘要（`diff`）。先吸收人的最新布局意图，再决定如何改块，绝不把旧顺序推回去。
3. **加锁、局部回写与完成**：
   - DSH 侧栏：`claim <task_id>` → 按锚点读出周围上下文并准备 patch JSON → `patch`（stdin）→ `complete <task_id>`。
   - 本地宿主：`POST /api/task/claim` → `POST /api/patch` → `POST /api/task/complete`。
   - 块级内容只通过 `patch` 按锚点写入，工作台开着时不整篇覆写文件。若块已不在文档中（`task_stale`），停止强改并请用户重新提交。
4. **待核对（`conflicts` / `deferred_blocks`）**：若用户与模型同时改了同一块，工作台把双方版本放进待核对并跳过覆盖。可运行 `conflicts` / `GET /api/conflicts` 查看，由用户在界面选 `mine` / `model` / `discard`，绝不代人裁决。

## 4. 旧项目只读兼容

旧 `.proposal-work/page-architecture.json` 在新工作台中**只读展示**，保存、重排与派发都会返回 `409 readonly`，磁盘零改动。新项目一律使用 `.planners/storyline.md`。
