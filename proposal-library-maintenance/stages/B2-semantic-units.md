# B2：切分语义单元并丢弃明确无价值页

## 本阶段在全流程中的作用

B2 的目标不是提取 Lens，而是把长方案切成适合提取 Lens 的独立语义单元。一个单元应共同完成一个问题、论证动作或输出，例如“六页品牌推导”“四页结构相同的竞品分析”“七页执行规划”。后续 B3b 逐单元工作，避免从整份长方案只抽出少数笼统方法。

## 模型的唯一任务

连续阅读同一 Deck 的全部页面，输出“从哪里分开”：

1. 把共同完成同一语义动作的页面放进一个单元。
2. 单元可以包含非连续页面；不能用固定页数或章节标题机械切分。
3. 每页必须恰好进入一个保留单元，或进入明确排除列表。
4. 辅助证明页可随主单元保留，但要通过 `support_page_ids` 标明。

## 可以排除的页面

只有删除后不会损失任何分析、推导、比较、规划或论证逻辑时才排除：

- 封面、目录；
- 团队介绍、公司资质、奖项罗列；
- 联系方式、法律声明；
- 空白页、纯章节过场；
- 只有装饰性图片且没有可恢复方法逻辑的页面；
- 与本次方案方法完全无关的附录。

文字少、看起来像创意、案例展示或执行内容，不是排除理由。不确定就保留，让 B3 判断。

## 明确禁止

- 不判断 Module，不命名 Lens，不发现 Recipe。
- 不读取已有 Wiki，不判断新增、合并或安装。
- 不建立“四池”，不创建 B2 人工审阅。语义切分由模型直接完成。
- 不改写页面原文。

## 输出、校验与物化

先用 `build-library-v4-packet.mjs` 将 `stages/B2-semantic-units.md`、`semantic-unit-plan.schema.json`、`page-manifest.jsonl` 和分页 Markdown 一起披露给模型。模型只输出 `semantic-unit-plan/1.0.0` JSONL。

```bash
node scripts/validate-semantic-unit-plans.mjs \
  --plans <运行目录>/B2/semantic-unit-plans.jsonl \
  --page-manifest <运行目录>/B1/page-manifest.jsonl

node scripts/materialize-semantic-units.mjs \
  --plans <运行目录>/B2/semantic-unit-plans.jsonl \
  --page-manifest <运行目录>/B1/page-manifest.jsonl \
  --text-root <分页 Markdown 目录> \
  --output-dir <运行目录>/B2/materialized
```

脚本只验证逐页覆盖、页 ID/页码配对、来源哈希，并把原文水合进单元；它绝不替模型切分或生成方法。

## 完成检查

- 无遗漏页、重复页或未知页。
- 每个单元有具体目的和边界理由。
- 最低可用产物 `semantic-units.jsonl` 含完整原文。
- 排除页理由只来自 Contract 允许的明确类型。
