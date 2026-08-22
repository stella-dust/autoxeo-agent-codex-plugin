---
name: manage-brand-wiki
description: 将用户授权的品牌资料整理为本地可追溯 Brand Wiki，管理实体、别名、事实、来源、冲突和禁止推断。用户要求建立或更新品牌知识库、品牌资料治理、Wiki 化管理或采集前准备时使用。
---

# Brand Wiki 管理

Brand Wiki 是当前工作区中的本地知识源，由当前 Codex 会话维护。Cloud 不生成 Wiki，插件不调用第二个模型。每条可引用事实必须绑定来源，无法证明的内容进入“禁止推断”或“待核验”。

## 工作流

1. 调用 `get_workspace_context`，检查 `brand-wiki/` 状态。读取用户明确授权的文件，不越过工作区边界。
2. 建立资料清单并分级：A 官方公开资料，C 用户授权的一手材料，B 可复核的公开行为观察。A 与 C 冲突时列出冲突，不自行选择方便的版本。
3. 更新 `brand-wiki/index.md`：品牌实体、产品服务、目标受众、场景、差异化事实、来源索引和禁止推断。
4. 为品牌、产品、服务区域、创始人或关键能力建立 `brand-wiki/entities/*.md`。记录规范名、别名、关系、事实、适用范围、有效期和 source refs。
5. 更新 `brand-wiki/evidence/registry.json`。每个 source 包含稳定 ID、层级、标题、URI 或相对路径、发布日期/访问日期、适用事实和限制。
6. 运行 `scripts/validate-wiki.mjs <workspace-root>`。修复断裂引用、重复 source ID 和缺少的核心章节。
7. 输出健康摘要：实体覆盖、已引用事实、冲突、过期项、缺口和下一步。数字只能来自验证脚本。

## 规则

- 不把营销口号、第三方转载或 Codex 推断写成已证实事实。
- 不写入 API Key、账号 Token、客户隐私或未授权原始材料。
- 更新既有事实时保留变更原因；事实变化不静默覆盖旧来源。
- Wiki 可以在未连接 Cloud 时工作；Cloud 项目名和品牌名只作上下文，不自动成为事实。

