# B4：完整人工审阅

## 人在这里审什么

B4 是全流程唯一的正式内容审批。人审阅完整 Lens、Recipe、Module 归属、页面结构和增补路线的语义差异，不审 B2 页面切分，也不需要重新逐页阅读整份 Deck 才能完成审批。页面仍显示来源 ID，供有疑问时回查。审阅顺序必须是先 Lens、后 Recipe；Recipe 页面显示每个 Lens 的最终安装去向。

## 必须主动打开

生成 HTML 文件不算进入人审。调度器必须**起审阅宿主**、打开唯一 review URL，并把状态改为 `waiting_for_human`。启动命令立即返回；模型告诉用户保存后回到 Codex 发送“已完成”，然后结束当前回合。不得长期等待终端或轮询文件。

```bash
node scripts/build-review-bundle.mjs \
  --curation <运行目录>/B3c/library-curation.json \
  --route <isolated_bootstrap|upgrade_existing> \
  [--alignment <运行目录>/B3d/wiki-alignment.json --wiki-dir <活动 Wiki>] \
  --output <运行目录>/B4/review-bundle.json

node scripts/build-review-page.mjs \
  --bundle <运行目录>/B4/review-bundle.json \
  --output <运行目录>/B4/review/index.html

node scripts/library-dispatch.mjs \
  --run-dir <运行目录> \
  --action start-review-session \
  --stage B4 \
  --html B4/review/index.html \
  --bundle B4/review-bundle.json \
  --port 0
```

**`start-review-session` 落到公共缝上**（2026-09-26 上缝）：它写 `B4/review/review-surface.json`、跑唯一校验器，然后把生命周期交给公共模组 `planners-review-core/scripts/review-host.mjs` —— 不再自带 server、不再 detached、也不再**强制**开浏览器。默认开（`open` 的语义），`--no-open` 关，`REVIEW_TEST_NO_OPEN=1` 也关。**开不了浏览器不是致命错误**：宿主如实回 `opened:false` 就继续，人要的 URL 就在返回值里，页面照 serve、反馈照收（无头 / CI / 手边没有图形界面都是常态）。

审阅页**不再自带服务器、不认端口与路径**：入口里只有一个裸的 `{{REVIEW_BRIDGE}}`（宿主原地注入桥），
页首有一个永远可见的刷新出口（`⟳`），保存与唤醒都走桥。反馈落在**提交文件** `B4/review/review-submissions.json`。

用户发送“已完成”“已反馈”或其他明确完成信号后，模型**按被钉住的顺序**做两件事：

1. **先收件**：`node scripts/review-inbox.mjs --surface <运行目录>/B4/review/review-surface.json`
   —— 它把提交翻译成原生 `review-feedback.json`，并把页面报上来的前提（有没有做版本核对）与**整体意见**放进收据；
2. **再跑门**：`node scripts/validate-review-feedback.mjs --feedback <运行目录>/B4/review/review-feedback.json --bundle <运行目录>/B4/review-bundle.json`
   —— **收件之前跑它一定失败**（它读的就是收件层写出来的那份文件）。

文件不存在时请用户回到页面重试；不得把口头确认转成手写反馈。校验通过后明确回复“已收到审阅反馈”，再创建 B4 回执并由调度器推进。

**只提交整体意见**（没有逐项处置）时收件层**不写**原生记录：原生契约要求 `decisions` 至少一条，那是本阶段的语义，宁可空着也不替人补一条假决定。整体意见的原文在收据里，也留在提交文件里。

## 页面允许怎么审（粒度与生命周期）

- **逐项不是唯一入口。** 页脚永远有一条「整体意见（不针对任何一个方法）」：只想说一句「这批方法整体不对」时，
  不必挑任何一条方法、不必逐项处置，直接写、直接交。它走提交文件 + 唤醒，不进原生记录（原生契约没有这个字段）。
- **改完即结束。** 页面**不存任何状态**（没有浏览器端草稿）：上一轮的备注原话不会预填，也不会把上一轮的意见带回来当待办。
  每一轮重新打开都是干净的“未处置”，一次点击就能批准，**没有要人先清空的东西**。
- **`defer`（暂缓）的意思是「这一轮先不动它」** —— 既不进安装，也不算拒绝。**它不是待办**：下一轮重新打开时，
  被 defer 过的那一条与其他方法完全一样是“未处置”，页面不挂任何跨轮标记。
- 页面自述“只读”的时刻是**明确的**：连上宿主之前、以及握手超时/没有宿主时，状态行都说清“内容能看、反馈存不进去”；
  内容本身**不依赖**桥（握手永不返回也照样完整画出）。

## 路线差异

- 独立新建库：只有批准、修改后批准、拒绝、暂缓；绝不显示“合并到已有 Lens”。
- 增补已有库：可选择新增、合并、变体、修订、补来源、改 Module、无变化、拒绝、暂缓。
- 合并、变体、修订、补来源必须从页面列出的已有目标中明确选择；脚本和安装器不得猜目标。
- `no_change` 也必须明确由哪个既有方法完整覆盖。
- `revise`、`merge`、`revision` 必须提交修改后的完整 proposal JSON，避免只给一句含糊批注。
- `merge` 表示人已经完成语义合并并批准最终对象；安装器只安装该最终对象，绝不自动拼接或以新对象覆盖旧对象。

## 人审界面与决定独立性

- 页面以人能阅读的字段、操作步骤、页面结构和差异卡片展示内容；原始 JSON 只能放在折叠的技术详情中。
- 清单和正文优先显示中文 Module 名，技术 ID 只作为辅助信息。
- 增补路线的目标选择器必须覆盖活动 Wiki 的全部可用 Lens/Recipe，并把 B3d 的 2–3 个候选放在最前，显示中文 Module、方法名和所解决问题；不能只给裸 ID。
- 对大量明显无价值对象，页面可提供“勾选后批量拒绝”等显式批量操作，但不得静默把模型建议当成人的决定。
- 模型的 `recommended_action` 只显示为“模型建议（仅供参考）”，不得预选决定，不得计入“已处置”。
- 首次打开页面时所有项目必须是未处置；只有人的明确点击或从本次 bundle 哈希绑定的本地草稿恢复，才能形成决定。
- 不要求用户填写审阅人。页面保存时使用固定的 `B4 人工审阅` 来源标识满足安装记录，不增加无意义的人名门槛。
- 增补路线必须展示被比较的既有 Lens/Recipe 全文。若 `matched_ids` 没有绑定可核验目标，页面要明确警告，不得用一段比较摘要伪装成完整对照。
- 修改决定可以从冻结对象载入完整 JSON 后编辑；页面必须先展示结构化内容，不能要求用户只靠阅读原始 JSON 完成审阅。
- Recipe 页面必须把来源 Lens ID 解析为“新 Lens ID”或“既有目标 Lens ID”。任一依赖被拒绝、暂缓或尚未处置时，Recipe 不能计为已完成，也不能保存为批准。
- 页眉和页脚使用开源来源标识：网站 `https://demyth.info`，小红书“阿祖不看 TVC”；该标识只用于过程审阅页，不进入最终客户交付物。

## 完成标准

`validate-review-feedback.mjs --feedback ... --bundle ...` 必须验证：

- 反馈绑定本次实际打开的 review bundle 哈希；
- 每项恰有一个决定，无遗漏和未知项；
- 决定属于当前路线允许范围；
- 需要目标的方法已选择有效目标；
- 修改、合并和修订决定包含符合冻结 Contract 的完整最终对象；
- 获准安装的 Recipe 的每个 Lens 依赖都有明确最终去向。

未处置、暂缓或拒绝内容不能进入 B5。
