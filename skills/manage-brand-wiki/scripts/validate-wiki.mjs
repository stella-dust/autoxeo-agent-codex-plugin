#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const wikiRoot = path.join(root, "品牌知识库");
const index = await readFile(path.join(wikiRoot, "索引.md"), "utf8");
for (const heading of ["品牌实体", "产品与服务", "受众与场景", "来源索引", "禁止推断"]) {
  if (!index.includes(`## ${heading}`)) throw new Error(`missing heading: ${heading}`);
}
const registry = JSON.parse(await readFile(path.join(wikiRoot, "证据", "登记册.json"), "utf8"));
if (registry.schemaVersion !== "autoxeo-evidence-registry.v1" || !Array.isArray(registry.sources)) throw new Error("invalid evidence registry");
const ids = new Set();
for (const source of registry.sources) {
  if (!source?.id || !["A", "B", "C"].includes(source.tier)) throw new Error("source requires id and tier A/B/C");
  if (ids.has(source.id)) throw new Error(`duplicate source id: ${source.id}`);
  ids.add(source.id);
}
const entities = await readdir(path.join(wikiRoot, "实体"), { withFileTypes: true });
const entryCount = entities.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).length;
process.stdout.write(`${JSON.stringify({ valid: true, entryCount, sourceCount: ids.size })}\n`);
