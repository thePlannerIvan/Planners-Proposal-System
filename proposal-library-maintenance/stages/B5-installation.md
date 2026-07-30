# B5：按 B4 决定确定性安装

## 本阶段在全流程中的作用

B5 没有语义判断。安装器只执行 review bundle 中的冻结对象和 B4 的逐项决定；不得重新提取、改写、自动合并、猜目标或安装暂缓/拒绝项。

## 安装前提

- `run-state.json` 是 v4，当前阶段为 B5。
- B1、B2、B3a、B3b、B3c、B4 均有调度器回执；增补路线还需 B3d 回执。
- `installation_permitted` 为 true。
- `review-feedback.json` 完整覆盖并绑定当前 `review-bundle.json`。

## 命令

```bash
node scripts/install-wiki-module.mjs \
  --bundle <运行目录>/B4/review-bundle.json \
  --feedback <运行目录>/B4/review/review-feedback.json \
  --wiki-dir <目标 Wiki 目录> \
  --run-state <运行目录>/run-state.json \
  --report-output <运行目录>/B5/install-report.json
```

## 脚本负责的机械动作

- 把批准的新 Lens 写入对应 Module。
- 仅按明确目标执行合并、变体、修订、补来源或改路由；合并和修订只接受 B4 批准的完整最终对象。
- 把可跨 Module 的 Recipe 写入 `wiki-recipes.json`，不复制成多个 Module 私有 Recipe。
- 根据 Lens 决定把 Recipe 中的来源 Lens ID 解析为最终安装 ID；依赖被拒绝、暂缓或缺失时整体拒绝安装。
- 安装前验证 `wiki-module` 和 `wiki-recipe-catalog` Contract。
- 安装前后验证完整 Wiki 引用图：所有 Recipe 成员与 step 必须指向真实 Lens，索引必须与 Module 文件一致。
- 为被修改的旧版本写 revision，更新 `wiki-index.json`，保存 install report。
- 使用临时文件替换；中途失败时恢复已覆盖文件并报 blocker。

安装器直接把同一份报告写入 Wiki revision 和运行目录，不再人工复制。安装报告必须包含通过的引用图完整性结果，并通过 `validate-install-report.mjs`。B5 通过后 `installation_permitted` 关闭，防止同一审批重复安装。
