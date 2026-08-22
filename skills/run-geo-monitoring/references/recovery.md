# 采集恢复规则

| 状态 | 用户说明 | 下一步 |
| --- | --- | --- |
| `queued` | 已创建 Job，尚未证明平台调用开始 | 稍后查询 |
| `running` | Cloud 正在执行，Credit 可能处于预留 | 查询进度，不重复创建 |
| `partial_failed` | 部分证据可用；失败项显式保留 | 只重试失败项 |
| `failed` | 说明是否产生证据和实际结算 | 使用原幂等语义恢复或重新 prepare |
| `cancelled` | 已停止未开始的工作；已有证据不删除 | 核对结算和可用证据 |
| `completed` | 仍需核对 provenance 与 settled Credit | 进入分析 |

`CONFIRMATION_EXPIRED`：重新 prepare 并再次确认。
`BUDGET_LIMIT_EXCEEDED`：降低平台/问题规模或由用户提高明确上限。
`AUTOXEO_ACCOUNT_SIGN_IN_REQUIRED`：保持本地数据不变，通过设备码登录官网已有 AutoXEO 账号；禁止回退到 Mock。
`CLOUD_HTTP_5xx`：仅对安全读或带同一幂等键的请求有限重试。
