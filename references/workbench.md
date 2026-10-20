# Storyline 工作台操作

适用于生成工作台、处理用户批注与恢复旧项目。交互规则先读 `planners-review-core/references/content-review.md`；本文件仅说明 Proposal 的入口和文件归属。

`<C>` 为本 Skill 的 `proposal-co-creation/scripts`，`<A>` 为当前 `page-architecture.json` 绝对路径，`<R>` 为同一项目的 `.proposal-work/reviews/structure`。

## 启动与恢复

先运行 `node "<C>/validate-page-architectures.mjs" "<A>"`，再运行：

```bash
node "<C>/start-page-review.mjs" --architecture "<A>" --review-dir "<R>"
```

DSH 有 `review_open` 时加 `--surface-only`，把返回的 surface 绝对路径交给插件打开；仅生成 surface 不代表已经打开。没有插件时同一入口启动或复用本地宿主并打开浏览器。测试或只检查产物时用 `--no-open`。

读取返回的 `canonical_path`、`review_context` 和 `workbench_head`。head 在工作台第一次连接后建立；正式交接前确认它真实存在并与主稿对应。恢复已有项目继续同一目录，先查看 head 与主稿，保护尚未消费的草稿。

## 处理修改任务

1. 读取 `<R>/workbench/head.json` 的 pending tasks，以及 canonical 主稿。任务的 revision/source_hash 必须与 head 一致，主稿字节也须匹配 source_hash。保存这组处理前的值。版本已变时核对用户新修改，不按旧页号直接动稿。
2. 根据 task 的 pages/entries 和意见处理指定页面，必要时检查前后论证；其他待处理任务不一并标记完成。遇到策略选择回到用户讨论。
3. 修改主稿并完成必要的内容检查后，在重新生成工作台之前标记已处理任务：

```bash
node "<C>/finish-review-task.mjs" --review-dir "<R>" --task-id "<id>" --revision "<处理前 revision>" --source-hash "<处理前 source_hash>"
```

此命令只更新任务状态；绑定不一致会拒绝操作，不表示用户批准。多条任务逐条处理并标记；模型编辑期间仍须保护新到达的用户修改。

4. 用同一启动命令重建工作台；以实际回执确认成功。读新 head 与主稿继续，不从旧反馈猜测当前内容。

## 历史版本

工作台自动保存当前内容并保留历史；用户在版本列表选择历史版本、点击“恢复此版”，页内再次确认后自动保存为新的修改。恢复失败或版本不兼容时保留当前内容并说明原因，不假报成功。模型重新生成导致编辑基线变化时，旧基线历史仍可保留供追溯；不能把旧草稿直接套到新基线。

## 仅用于旧项目的 legacy 路径

只有明确恢复使用旧反馈提交的 2.0 项目时加 `--legacy-review true`。该模式才产生 `review-submissions.json`，按顺序运行：

```bash
node "<C>/review-inbox.mjs" --review-dir "<R>"
node "<C>/validate-page-review-feedback.mjs" --feedback "<R>/review-feedback.json" --architecture "<A>"
```

新项目不用 inbox、legacy feedback 或 overall_decision 作为继续工作的批准门。兼容界面的提交机制不改变当前 Workbench 的自动保存约定。
