# B1：准备可信的分页语料

## 本阶段在全流程中的作用

B1 只建立“后续判断可以信赖的逐页原文”。它不理解方案、不分段、不总结、不判断哪些内容有方法价值。最低可用产物是保留原页边界的 Markdown；缺少这个产物，B2 无法可靠工作。

## 输入与唯一输出

- 输入：PDF、PPTX 或已提取文本。
- 中间产物：每份 Deck 对应一个 UTF-8 Markdown，以换页符 `\f` 分隔原始页面。
- 输出：`corpus-manifest.jsonl`、`page-manifest.jsonl`、`b1-report.json`。

PDF/PPTX 的读取应调用相应文件读取能力生成分页 Markdown。不要让语言模型凭记忆重写页面，不要把整份方案压成一段摘要。纯视觉信息无法提取时，在对应页文本中标注“视觉信息未恢复”，不得补造。

## 脚本

```bash
node scripts/prepare-paged-markdown.mjs \
  --text-root <分页 Markdown 目录> \
  --corpus-id <本次语料 ID> \
  --output-dir <运行目录>/B1

node scripts/validate-b1-output.mjs \
  --report <运行目录>/B1/b1-report.json \
  --page-manifest <运行目录>/B1/page-manifest.jsonl
```

脚本只建立稳定 ID、页码、哈希和文件定位；不会做语义补全。超过 12000 字节却没有 `\f` 的 Markdown 会阻断，防止整份 Deck 被误当成一页。

## 完成检查

- 每个原始页面都对应一个 page ID、页码、来源文件、文本哈希。
- Markdown 可以按 `text_path + page_number` 回到原文。
- 页边界不可靠、文本缺失或严重乱码时，记录 blocker 并停止。
- 回执必须运行 `validate-b1-output.mjs`；B1 通过后才能把分页语料交给 B2。
