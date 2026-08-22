#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
const [baselinePath, retestPath, outputPath] = process.argv.slice(2);
if (!baselinePath || !retestPath || !outputPath) throw new Error("Usage: compare-retest.mjs <baseline.json> <retest.json> <comparison.json>");
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const retest = JSON.parse(await readFile(retestPath, "utf8"));
const comparable = baseline.questionSetId === retest.questionSetId && baseline.methodVersion === retest.methodVersion;
const keys = ["visibilityRate", "recommendationRate", "firstRecommendationRate", "sourceRate", "questionFacetOccupancy"];
const deltas = {};
if (comparable) {
  for (const key of keys) {
    const before = baseline.metrics?.[key];
    const after = retest.metrics?.[key];
    deltas[key] = typeof before === "number" && typeof after === "number" ? Number((after - before).toFixed(4)) : null;
  }
}
const result = {
  schemaVersion: "autoxeo-retest-comparison.v1",
  comparability: comparable ? "comparable" : "not_comparable",
  reasons: comparable ? [] : ["questionSetId or methodVersion differs"],
  baseline: { collectionRunId: baseline.collectionRunId, sampleCount: baseline.sampleCount, excludedCount: baseline.excludedCount },
  retest: { collectionRunId: retest.collectionRunId, sampleCount: retest.sampleCount, excludedCount: retest.excludedCount },
  deltas,
};
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ valid: true, comparability: result.comparability, outputPath })}\n`);

