---
name: compare-geo-retest
description: 对同一冻结问题集的 GEO 基线与复测进行可比性检查、确定性差异计算、变化解释和下一轮行动建议。用户要求复测分析、前后对比、优化效果验证或阶段复盘时使用。
---

# GEO 同题复测分析

复测先证明可比，再讨论变化。当前 Codex 会话解释变化；脚本只核对问题身份和计算差异。

## 工作流

1. 读取基线与复测 dataset/summary。两批必须记录 question set、问题 identity hash、平台、区域/语言、模型/能力版本、采集窗口、方法版本和 Evidence 状态。
2. 运行 `scripts/compare-retest.mjs <baseline-summary.json> <retest-summary.json> <comparison.json>`。若问题集或方法版本不一致，结果必须为 `not_comparable`，不得输出效果结论。
3. 分开解释：品牌正文提及变化、推荐变化、首位变化、来源命中变化、问题覆盖变化和平台结构变化。样本失败、平台版本变更和时间窗口差异是限制，不是品牌效果。
4. 变化按三类输出：可确认事实、合理解释、待验证假设。任何归因都必须指出还能由什么外部变化解释。
5. 生成 `analysis/retests/<date>-retest.md`、`comparison.json` 和 `next-cycle.json`。列出保留动作、停止动作、修订内容、未解决问题和下一复测窗口。
6. 报告必须明确基线/复测样本数、排除项、可比性判定、Evidence refs 和局限；完成后登记本地产物 hash。

## 真实性边界

- “同题”意味着稳定问题 identity，不是文本看起来相似。
- 小样本变化不自动代表趋势；不得伪造显著性或 ROI。
- 案例中的正向结果只用于学习报告结构，不能作为当前项目先验。

