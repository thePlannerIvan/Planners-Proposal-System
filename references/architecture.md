# Proposal 的职责与交接

Proposal 负责项目理解、共创判断、Storyline 与结构参考。主流程的唯一说明在根 `SKILL.md`；本文件供维护接口时使用，不增加生产步骤。

| Module | 唯一主人 | Interface | 不承担 |
|---|---|---|---|
| 项目理解与决定 | Proposal | `project-memory.md` | 不复制聊天或完整 Storyline |
| 来源登记 | Proposal 写入；planners-source-index 定义与校验 | `source-index.json` | 公共模组不阅读材料、不生成项目结论 |
| 策略研讨 | sparkling 提供方法；Proposal 保持项目推进 | 白板与收敛判断 | 不以问答次数证明方向成熟 |
| 叙事与甲板组织 | storytelling / slide-copy 提供方法；Proposal 使用 | Storyline、章节与证明需要 | 不提前完成逐页稿 |
| Wiki 查询 | 现有只读查询脚本 | 项目问题、Wiki 路径 → Lens | 不提供项目答案，不修改 Wiki |
| 结构表达与回写 | Proposal | `page-architecture.json`、builder、inbox | 不决定 PPT 模板或完整内容 |
| 审阅传输与宿主 | planners-review-core | surface、提交、草稿 | 不替生产方解释批准、不回写业务正文 |
| 内容展开与最终核查 | planners-bypage | 项目记忆、来源、结构、当前反馈 | 不静默改变上游已确认判断 |

## 真相与路径

- `project-memory.md` 保存项目理解、用户决定和未决问题；Sparkling 白板保存研讨状态，收敛后只转接必要结论。
- `source-index.json` 保存资料路径、原文定位、阅读覆盖和派生副本；字段只跟公共模组的当前契约走。相对路径以索引目录为基准，移动时需重定位。
- `page-architecture.json` 保存当前 Storyline 与结构参考；不再另维护一个完整 Storyline 文件。
- 审阅提交由公共宿主保存；Proposal 的 `review-inbox.mjs` 保护原文、回写编辑、映射新页号。`validate-page-review-feedback.mjs` 检查反馈是否有效并绑定当前结构；调用者另读 `overall_decision`，有效的 revise 不是批准。

## 工具入口

公共模组由 `proposal-co-creation/scripts/lib/planners-modules.mjs` 解析；现有 adapter 调用公共实现，不复制审阅壳、桥或生命周期。安装缺失模组仍遵循环境权限。

Wiki 由独立的 `planners-method-wiki` 提供。Proposal 和 By-page 按名称调用它，查询、采用记录和库选择只由该 Skill 定义；生产交接沿用同一项目记忆和方法库，Lens / Recipe 与维护测试不再留在 Proposal 中。

Proposal 向 By-page 交出四个原文件的绝对路径、确认判断、证据边界、未决问题和发展空间。当前机器格式保持兼容；如果要缩减结构契约，需与 By-page 及审阅 adapter 一起改，而不是只删上游字段。

## 退役

原 C1-C4 与详细 WORKFLOW 的重复规则已归档到源库 `_archive/proposal-co-creation-pre-simplification-2026-10-08/`，不随 Skill 发布。固定问答往返、奥美三圈必经、Wiki 固定两次查询和逐阶段回退不再是写方案的运行条件。旧 Workflow 定位页和两个辅助镜头已删除；研讨方法由 sparkling 提供，特定方法通过 Wiki 查询。
