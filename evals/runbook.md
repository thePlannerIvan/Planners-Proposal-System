# 验收范围

内容行为判据见 [evals.json](evals.json)。独立模型试跑需提供真实或明确标记的样本资料，检查实际主线、工具调用和工作台交付；工程测试不能替代专业判断。

当前格式检查：`node evals/co-creation/storyline-doc.mjs`。它覆盖模板与真实样例过 `planners-doc/2` 校验、每页有主张有支撑（删支撑 / 删主张被拒）、工作台按块读出 10 页并改通一块，以及 SKILL 只描述文档形态。不需要浏览器。

文档用例按 `planners-doc/2` 写，必须解析到同样含 /2 与 `scripts/migrate-doc.mjs` 的 planners-review-core。库里 vendored 的 `00-system/planners-review-core` 要到 PR 合并 / 正式发布那一步才同步，在那之前用 `PLANNERS_MODULES_HOME=<含 planners-review-core/ 的目录>` 或 `PLANNERS_REVIEW_CORE_HOME=<review-core 检出目录>` 跑这一套：后者会被接进既有 `PLANNERS_MODULES_HOME` 解析顺序的最前面。正式环境不需要这两个变量。

旧 JSON 主稿的轻量接口检查：`node evals/co-creation/storyline.mjs`。它覆盖主张与支撑增删清空、新页、排序、冲突、批注映射、任务处理、重建和 By-page 接收；不启动浏览器。这条路径只验证兼容，不定义新项目的写作形态。

完整验收在 By-page 简化后联合进行：浏览器中只改一个块无需点击即落盘、刷新恢复、空支撑新页可编辑、拖动块与页、批注绑定块身份、历史版本恢复、模型更新后的明确提示、无手动保存入口；分别覆盖本地与 DSH 宿主。再走 Proposal → By-page 的真实交接（storyline.md 交给下游）。尚未执行这些检查不能声明浏览器或全链路通过。

`co-creation/run.mjs`、`co-creation/edits.mjs`、`co-creation/workbench-ui.mjs`、`workflow/run.mjs` 的旧批准与 inbox 用例只验证 2.0 legacy 兼容，不定义默认工作台的继续条件。
