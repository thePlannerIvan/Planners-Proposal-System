# C4 结构审阅与交接

## 本阶段目的

让用户一次性审阅 Storyline 的整体推进和展开后的全部页面，不再分别确认 Storyline 与页面列表。

## 自动启动

Validator 通过后立即运行，不询问用户是否需要网页：

```bash
node "<Planners-Proposal-System 目录>/proposal-co-creation/scripts/start-page-review.mjs" \
  --architecture "<project>/.proposal-work/page-architecture.json" \
  --review-dir "<project>/.proposal-work/reviews/structure" \
  --port 0
```

脚本必须自动打开浏览器并立即返回 `feedback_path`。模型告诉用户：

> 审阅页面已经打开。全部页面默认通过，只需要修改有问题的页面；输入反馈会自动切换为“需要修改”。保存后回到 Codex 发送“已完成”。

随后结束当前回合。不要保持终端等待、轮询文件或假装已经收到反馈。

## 用户返回后

用户发送“已完成”“已反馈”等明确信号后：

1. 检查 `feedback_path`真实存在；
2. 运行反馈 Validator，并绑定当前 Architecture Hash；
3. 明确回复“已收到审阅反馈”；
4. 有 `revise`页面时，根据逐页反馈修改结构；
5. 反馈触及主方向时回到 C2，触及认知推进时回到 C3；
6. 修改后重新验证并再次自动打开完整结构审阅。

不得根据用户口头确认自行生成反馈文件。

## 页面展示

主界面只突出：

- 章节与页序；
- 页面标题；
- 核心判断；
- 分行内容块。

页面任务、后续取材和转场折叠为工作信息。图表、配图、版式通常不在此阶段要求用户判断。

## 交接

只有反馈与当前文件 Hash 一致且 `overall_decision`为 `approve`，才读取 `../../proposal-by-page-copy/WORKFLOW.md`并进入逐页文案工作流。

交接时明确告诉下游：

- 主方向和 Storyline 已锁定；
- 哪些页面判断不可无声改变；
- 哪些取材与内容形式仍由 By-page 发展；
- 原始资料、项目工作记忆与来源索引在哪里。

不要让用户重新解释 Brief，不要再进行一次 Storyline 确认。

## 诚实终态

- 网页未打开：报告脚本错误和 review URL，不以 Markdown 假装完成审阅。
- 反馈未保存：请用户回页面重试。
- 反馈 Hash 过期：重建页面并重新审阅。
- 存在修改项：不能交给 By-page。

## 完成标准

- HTML 已自动打开；
- 用户只审阅最重要的结构信息；
- 输入反馈自动切换修改状态；
- 反馈可靠保存并绑定当前结构；
- 整体批准后已直接交接 By-page Copy。
