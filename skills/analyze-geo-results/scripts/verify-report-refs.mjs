#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const target = process.argv[2];
if (!target) throw new Error("Usage: verify-report-refs.mjs <report.md>");
const report = await readFile(target, "utf8");
const required = ["数据范围", "方法", "provenance", "Evidence", "限制", "复测"];
const missing = required.filter((term) => !report.includes(term));
if (missing.length) throw new Error(`report is missing: ${missing.join(", ")}`);
process.stdout.write(`${JSON.stringify({ valid: true, required })}\n`);
