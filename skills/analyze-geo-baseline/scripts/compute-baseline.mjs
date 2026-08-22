#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("Usage: compute-baseline.mjs <dataset.json> <summary.json>");
const dataset = JSON.parse(await readFile(inputPath, "utf8"));
if (dataset.provenance !== "official_api" || !Array.isArray(dataset.observations)) throw new Error("official_api observations required");
const rows = dataset.observations.filter((row) => row.evidenceStatus === "observed");
const ratio = (count) => rows.length ? Number((count / rows.length).toFixed(4)) : null;
const byPlatform = {};
for (const row of rows) {
  const bucket = byPlatform[row.platform] ??= { samples: 0, mentioned: 0, recommended: 0, first: 0, cited: 0 };
  bucket.samples += 1;
  if (row.brandMentioned) bucket.mentioned += 1;
  if (row.recommended) bucket.recommended += 1;
  if (row.firstRecommended) bucket.first += 1;
  if ((row.citations ?? []).length > 0) bucket.cited += 1;
}
const summary = {
  schemaVersion: "autoxeo-baseline-summary.v1",
  methodVersion: dataset.methodVersion,
  questionSetId: dataset.questionSetId,
  collectionRunId: dataset.collectionRunId,
  sampleCount: rows.length,
  excludedCount: dataset.observations.length - rows.length,
  metrics: {
    visibilityRate: ratio(rows.filter((row) => row.brandMentioned).length),
    recommendationRate: ratio(rows.filter((row) => row.recommended).length),
    firstRecommendationRate: ratio(rows.filter((row) => row.firstRecommended).length),
    sourceRate: ratio(rows.filter((row) => (row.citations ?? []).length > 0).length),
    questionFacetOccupancy: dataset.questionFacetOccupancy ?? null,
  },
  byPlatform,
  evidenceRefs: rows.flatMap((row) => row.evidenceRefs ?? []),
};
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ valid: true, sampleCount: rows.length, outputPath })}\n`);

