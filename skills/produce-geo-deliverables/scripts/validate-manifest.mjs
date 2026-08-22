#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const target = process.argv[2];
if (!target) throw new Error("Usage: validate-manifest.mjs <manifest.json>");
const manifest = JSON.parse(await readFile(target, "utf8"));
if (manifest.schemaVersion !== "autoxeo-deliverable-manifest.v1" || !Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) throw new Error("invalid deliverable manifest");
for (const artifact of manifest.artifacts) {
  for (const key of ["path", "sha256", "audience", "status", "createdAt"]) if (!artifact[key]) throw new Error(`artifact missing ${key}`);
  if (!Array.isArray(artifact.sourceRefs)) throw new Error("artifact sourceRefs must be an array");
}
process.stdout.write(`${JSON.stringify({ valid: true, count: manifest.artifacts.length })}\n`);

