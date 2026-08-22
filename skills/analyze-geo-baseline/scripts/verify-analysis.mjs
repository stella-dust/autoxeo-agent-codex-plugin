#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const target = process.argv[2];
if (!target) throw new Error("Usage: verify-analysis.mjs <report.md>");
const text = await readFile(target, "utf8");
for (const heading of ["范围与方法", "确定性事实", "Codex 解释", "行动计划", "限制与复测协议"]) {
  if (!text.includes(heading)) throw new Error(`missing section: ${heading}`);
}
if (!/Evidence|evidence/.test(text)) throw new Error("report must reference Evidence");
process.stdout.write(`${JSON.stringify({ valid: true })}\n`);

