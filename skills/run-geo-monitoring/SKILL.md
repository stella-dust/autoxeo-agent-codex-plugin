---
name: run-geo-monitoring
description: 对中国五家 AI 平台采集执行连接检查、能力预检、Credit 估算、确认、启动、轮询与失败恢复。用户要求运行 GEO 监测、建立基线、复测或查看采集状态时使用。
---

# GEO 平台采集

平台采集是 AutoXEO Cloud 的权威执行链路。Codex 负责解释和编排，不得用自己的回答冒充豆包、千问、DeepSeek、腾讯混元或 Kimi 的 observed 结果。

## 执行前

1. 调用 `connection_status`，报告模式、协议、证据状态与采集通道。
2. 调用 `get_task_snapshot`，确认冻结问题版本、任务预算、当前节点与唯一 nextAction。
3. 若账号、Cloud 或目标平台不可用，停止采集并说明阻塞；不得生成模拟回答或模拟 Credit。
4. 调用 `prepare_capture`，传入已冻结的 `questionSetId`、目标 `platforms` 和用户可接受的 `maxCredit`。

## 确认与执行

prepare 后展示：平台能力、搜索开关、预估 Credit、最高预算、票据过期时间、数据/扣费影响。只有用户明确批准，才调用 `start_capture`；为同一用户动作生成并复用一个稳定 `idempotencyKey`。

启动后记录 `jobId`、`receiptId`、`provenance` 和预留 Credit。使用 `get_job` 查询，避免紧密轮询。部分失败时只重试失败平台/问题；取消不删除已产生证据，需说明预留和真实结算状态。

## 证据规则

- 只有 `official_api` 且官方联网搜索证据验证通过，才可能标 `observed`。
- Codex 代答、模型仿真、缺搜索证据的回答永远不能进入 observed 指标。
- “Job 已创建”“Cloud 已接受”“平台已返回”“Credit 已结算”是四个不同状态，不能合并表述。
- 不在消息、文件或日志中写入 access token；不要求用户提交五平台密钥。

错误与恢复规则见 [recovery.md](references/recovery.md)。
