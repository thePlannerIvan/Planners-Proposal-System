# Proposal 的职责与接口

生产流程以 [SKILL.md](../SKILL.md) 为准；本文件用于维护接口，不增加工作步骤。

| 所属方 | 职责与接口 |
|---|---|
| Proposal | 理解项目、推进讨论、形成主线；维护同一 project-memory.md、source-index.json 与 page-architecture.json |
| sparkling / Method Wiki / storytelling / slide-copy | 研讨、专业知识与方法、认知推进、幻灯片表达；按各 Skill 指引调用 |
| planners-source-index | 定义并校验来源契约，Proposal 负责真实阅读与登记 |
| Proposal adapter | 将 3.0 主张、支撑与备注映射到工作台，回写同一原件；2.0 仅为旧项目兼容 |
| planners-review-core | 当前交互规则、自动保存、版本管理、草稿与受限命令传输；唯一实现，不复制审阅壳 |
| planners-bypage | 接收主线并发展完整内容；转换器支持 3.0 和旧 2.0，上游文件保留原位置 |

## 当前规则与维护范围

修改审阅行为前读取 `planners-review-core/references/content-review.md`。底层 save 命令是内部实现，用户操作是编辑、查看或恢复版本、提交修改意见；不据旧说明加回手动保存按钮。宿主差异限于打开与唤醒能力，不改变自动保存行为。

当前 schema 与模板只表达 3.0，旧 schema 在 contracts/legacy，旧测试夹具在 evals/fixtures。默认工作台测试走 co-creation/storyline.mjs；旧 inbox 和反馈用例仅验证兼容分支。维护格式时同时检查 builder、回写 adapter、By-page 转换器与实际用例。

根入口负责内容判据；[主线格式](../proposal-co-creation/contracts/page-architecture.md) 负责字段；[工作台操作](workbench.md) 负责启动、任务处理和兼容说明。历史记录不参与日常生产。
