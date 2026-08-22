---
name: run-official-monitoring
description: 通过 AutoXEO Cloud 官方 API 执行中国 AI 平台 GEO 基线或复测采集，完成账号检查、能力预检、Credit 确认、Job 查询和失败恢复。用户要求开始采集、监测、建立基线、复测或查看采集状态时使用。
---

# 官方平台 API 采集

采集是唯一由 Cloud 执行的 GEO 核心环节。Codex 负责编排和解释，不用自身回答冒充平台结果；插件不包含浏览器采集或模型模拟。

## 执行

1. 调用 `connection_status` 与 `get_workspace_context`。确认 AutoXEO 账号、Cloud 项目、冻结问题集和任务 Credit 上限。
2. 只选择 Cloud 明确标为 ready 的官方 API 能力。`configuration_required`、`eligibility_required` 和 `unavailable` 都必须停止，不得降级到模拟。
3. 调用 `prepare_official_collection`。向用户展示平台、问题版本、Evidence 门、搜索能力、预估 Credit、最高预算、失败计费规则和票据过期时间。
4. 只有用户明确批准后才调用 `start_official_collection`，并为同一用户动作生成和复用稳定 `idempotencyKey`。
5. 记录 `jobId`、`receiptId`、`provenance` 和预留 Credit。使用 `get_collection_job` 间隔查询，不紧密轮询。
6. 完成后调用 `get_analysis_dataset`。保存到 `collections/datasets/<job-id>.json`，不改写返回的确定性指标。

## 状态语言

“票据已准备”“Job 已创建”“Provider 已返回”“Evidence 门已通过”“Credit 已结算”是五个不同状态。只有 `official_api` 且 Evidence 门通过的数据可进入 observed 分析。部分失败只重试失败的问题/平台；取消不删除已产生的 Evidence。

