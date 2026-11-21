# 验收范围

行为判据见 [evals.json](evals.json)。

当前自动化检查入口：`node evals/run-all.mjs`：
1. `evals/co-creation/storyline-doc.mjs`：校验 `templates/storyline.md` 与 `evals/fixtures/labbrand-storyline.md` 通过 `planners-doc/2` 与提案校验（缺主张 / 缺支撑 / 多主张被拒），启动 `doc-workbench.mjs` 按块读写 `storyline.md`，并确认 `SKILL.md` 与新路径对齐。
2. `scripts/lib/planners-modules-install.test.mjs`：公共模组解析与安全落点不变性测试。

在 CI 或暂未发布 `planners-review-core` 的开发环境下，可设 `PLANNERS_MODULES_HOME` 或 `PLANNERS_REVIEW_CORE_HOME` 指向本地 `planners-review-core` 目录；日常直接运行即可解析到同库 `00-system/planners-review-core`。
