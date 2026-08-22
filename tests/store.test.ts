import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectStore } from "../src/store.js";

describe("ProjectStore", () => {
  let container: string; let projectRoot: string;
  beforeEach(async () => { container = await mkdtemp(path.join(tmpdir(), "autoxeo-store-")); projectRoot = path.join(container, "AutoXEO_Workspace"); });
  afterEach(async () => rm(container, { recursive: true, force: true }));
  it("creates the Codex-native workspace and classifies artifacts", async () => {
    const store = new ProjectStore(projectRoot);
    await store.snapshot({ refreshArtifacts: true });
    await writeFile(path.join(projectRoot, "analysis", "baselines", "baseline.md"), "# 基线\n");
    const indexed = await store.snapshot({ refreshArtifacts: true });
    expect(indexed.schemaVersion).toBe(2);
    expect(indexed.artifacts.find((item) => item.relativePath.endsWith("baseline.md"))?.kind).toBe("baseline_analysis");
    expect(JSON.parse(await readFile(path.join(projectRoot, ".autoxeo/state/plugin-v2.json"), "utf8"))).toMatchObject({ schemaVersion: 2 });
  });
});
