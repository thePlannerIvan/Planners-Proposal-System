# 逐页工作稿格式

`by-page-copy/2.0.0` 是 By-page 在 `.proposal-work/proposal-draft.md`中使用的内部工作格式。它为审阅页面和最终打包提供稳定页边界，不要求 Evidence Ledger。

## 每页格式

```markdown
---
contract_version: 2.0.0
page_number: 1
section_id: sec-example
page_title: "观点式标题"
main_claim: "本页唯一主要判断"
---

## Page Content

页面上真正需要看到的完整内容。可以包含段落、列表、Markdown 表格、图片、图表说明、模型、矩阵或路线图。

## Production Notes

仅保留设计和制作真正需要的信息，例如图表数据关系、图片裁切要求或不可见的制作提醒。不要重复主体内容。
```

## 规则

1. 页码从 1 连续递增。
2. 标题和核心判断不能为空。
3. `Page Content`必须有实际内容，不能只有“待补充”“放图”“做表格”等占位语。
4. 不限制固定字数或内容块数量；内容应在一页容量内完整证明判断。
5. 表格、图表和图片必须提供足够信息让下游理解和制作。
6. 来源定位与事实审计留在 `.proposal-work/fact-audit.json`，不写进客户可见正文。
7. 最终 `deliverable/proposal.md`会删除 Frontmatter 与内部工作信息。
