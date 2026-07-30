# B3a：发现方案中的 Recipe

## 本阶段在全流程中的作用

Recipe 记录“怎样组织一套推导”：前一步的输出怎样成为下一步输入，帮助未来写方案时选择和排列方法。它可以跨 Module，也可以只覆盖 Deck 的一部分。它不是 Deck 摘要、目录复述、固定页数模板或通用“分析—洞察—策略”口号。

## 模型任务

一次阅读同一 Deck 的全部保留语义单元，而不是逐单元孤立判断：

1. 识别真实存在的推导链、反馈回路或有条件分支。
2. 为每一步说明功能角色、所需输入、产生输出、来源单元和与前后步骤的依赖。
3. 区分原始页序与逻辑顺序；页码靠后不一定逻辑靠后。
4. 并列分析只有在输出确实汇合到下一步时才属于 Recipe。
5. 可以发现多条、局部一条或零条 Recipe。证据不足时不要为了完整性硬凑。

## 去项目化要求

Recipe 描述的是可复用的推导关系。品牌名、品类名、具体产品、竞品、slogan、活动、预算、渠道、排期、场景和本项目结论必须转化为通用输入/输出类型，或只留在来源证据中。此阶段不正式生成 Lens，但应指出每一步承担的“方法角色”，供 B3b 映射。

## 明确禁止

- 不读取已有 Wiki。
- 不把章节目录直接当 Recipe。
- 不因为页面连续就假定前后依赖。
- 不在证据没有支持时补造分支、输入或输出。

## 输出和命令

用 `build-library-v4-packet.mjs` 把全部 `semantic-units.jsonl`、本文件全文和 `recipe-discovery.schema.json` 放入同一任务包。输出 `recipe-discovery/1.0.0`；每个 Deck 一条记录，允许 `recipes: []`。

```bash
node scripts/validate-recipe-discoveries.mjs \
  --input <运行目录>/B3a/recipe-discoveries.jsonl \
  --units <运行目录>/B2/materialized/semantic-units.jsonl
```

Validator 检查 Contract、步骤序号、来源单元闭包，并确保每个 Deck 都有一条记录；不评价 Recipe 是否“聪明”。模型必须自行检查依赖是否真实、是否仍残留项目填充值。
