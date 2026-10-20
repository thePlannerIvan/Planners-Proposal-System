# 验收范围

内容行为判据见 [evals.json](evals.json)。独立模型试跑需提供真实或明确标记的样本资料，检查实际主线、工具调用和工作台交付；工程测试不能替代专业判断。

当前格式轻量接口检查：`node evals/co-creation/storyline.mjs`。它覆盖主张、支撑增删清空、新页、排序、冲突、批注映射、任务处理、重建和 By-page 接收；不启动浏览器。

完整验收在 By-page 简化后联合进行：浏览器中只改主张或支撑无需点击即落盘、刷新恢复、空支撑新页可编辑、页序与批注绑定、历史版本恢复、模型更新后恢复旧基线的明确提示、无手动保存入口；分别覆盖本地和 DSH 桥。再走 Proposal → By-page 的真实交接。尚未执行这些检查不能声明浏览器或全链路通过。

`co-creation/run.mjs`、`co-creation/edits.mjs`、`workflow/run.mjs` 的旧批准与 inbox 用例只验证 2.0 legacy 兼容，不定义默认 Workbench 的继续条件。
