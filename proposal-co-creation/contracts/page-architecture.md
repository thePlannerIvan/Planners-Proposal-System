# Storyline 主稿格式

新项目使用 `contract_version: "3.0.0"`，文件名沿用 `.proposal-work/page-architecture.json`。机器字段见 [schema](page-architecture.schema.json)，可填写例子见 [模板](../templates/page-architecture.json)。

| 内容 | 字段 | 规则 |
|---|---|---|
| 整案判断 | `storyline_thesis` | 一份主线只维护一处 |
| 章节 | `sections[{section_id,title}]` | 只保存章节身份和标题，短稿可只有一个章节 |
| 每页 | `pages[{page_number,section_id,claim,supports,notes?}]` | 一句主张、支撑判断列表、可选备注；页号连续 |
| 项目身份 | `project_id` | 沿用已有稳定身份，格式 `pj_` 加 24 位十六进制字符 |

`claim` 是工作台每行可编辑的文字，不另维护 title_intent 或 page_job。`supports` 是自然语言判断列表，不要求块标题、role 或表达形式。备注 `notes` 承载必要来源定位、证据缺口与限定，不是给模型的批注任务。

工作台允许新页和编辑中的支撑列表为空，以免阻断修改；正式交接前运行 `validate-page-architectures.mjs <file> --ready`，再由模型检查内容充分性。通常两三条支撑是写作指引，不是 schema 的硬限制。

工作台回写同一主稿；原页号是本轮编辑基线中的页面身份，排序回执给出新页号映射。旧基线的任务不能按新页号猜测对应，必须核对 revision/source_hash。跨阶段沿用真实路径，By-page 将主线转换为自己的工作结构，不覆盖原件。

## 旧项目

验证器及 By-page 接收器继续读取 2.0.0，旧 schema 留在 [兼容格式](legacy/page-architecture-v2.schema.json)。这仅用于已有项目和兼容用例，不再是新项目的写作要求。已有工作台继续原版本，不在有未处理草稿时自动迁移。需要升级旧项目时先保留原稿、处理草稿与任务，再由模型核对主张、支撑和原字段中的证据边界，生成 3.0 主稿；不通过字段拼接猜测主张。
