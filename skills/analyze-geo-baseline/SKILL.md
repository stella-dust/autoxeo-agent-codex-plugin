---
name: analyze-geo-baseline
description: 基于 official_api Evidence 和确定性数据集完成 GEO 基线分析，解释品牌可见、推荐、来源与问题覆盖，并生成可复核报告。用户要求分析首次采集、平台差异、可见度、竞品、来源或基线报告时使用。
---

# GEO 基线分析

确定性脚本计算事实，当前 Codex 会话解释原因、优先级和行动。不得修改脚本产出的指标，不得让脚本调用任何模型。

## 工作流

1. 调用 `get_analysis_dataset` 或读取 `采集数据/数据集/*.json`。验证 `provenance=official_api`、方法版本、问题集 ID、采集时间、平台和 Evidence refs。
2. 运行 `scripts/compute-baseline.mjs <dataset.json> <summary.json>`。指标至少包括品牌提及率 VR、推荐率 RR、首位推荐率 FRR、来源命中率 SR、问题覆盖 QFO 和平台样本数。
3. 逐层诊断：平台差异、问题类型、品牌提及规则、竞品关系、来源域、答案正文提及与引用来源的差异。
4. 每条关键结论绑定 summary 字段或 Evidence ref。Codex 推断必须写为“解释”或“待验证假设”。
5. 生成 `分析/基线/<date>-基线分析.md`、`基线摘要.json`、`行动计划.json`。报告包括管理摘要、范围方法、事实、解释、问题清单、90 天行动、限制与复测协议。
6. 运行 `scripts/verify-analysis.mjs <report.md>`，再用 `register_local_artifact` 核验文件 hash。

## 禁止事项

- 不把正文品牌提及、来源引用、推荐排序混成一个“曝光率”。
- 不对失败/缺失回答补零后假装完整样本。
- 不把案例参考中的客户数字、平台结论或 ROI 搬到当前项目。
