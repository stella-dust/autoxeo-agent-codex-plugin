import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectStore } from "../src/store.js";

describe("ProjectStore", () => {
  let container: string;
  let projectRoot: string;
  beforeEach(async () => {
    container = await mkdtemp(path.join(tmpdir(), "autoxeo-store-"));
    projectRoot = path.join(container, "AutoXEO_Workspace");
  });
  afterEach(async () => { await rm(container, { recursive: true, force: true }); });

  it("initializes the production workspace and restores versioned state", async () => {
    const first = new ProjectStore(projectRoot);
    const state = await first.snapshot({ refreshArtifacts: true });
    await writeFile(path.join(projectRoot, "report.md"), "# GEO report\n");
    const indexed = await first.snapshot({ refreshArtifacts: true });
    expect(indexed.nodes).toHaveLength(6);
    expect(indexed.artifacts.map((item) => item.relativePath)).toContain("report.md");
    await first.addActivity({ type: "system", title: "恢复测试", detail: "persisted", status: "success" });
    const restored = await new ProjectStore(projectRoot).load();
    expect(restored.activity[0]?.title).toBe("恢复测试");
    expect(JSON.parse(await readFile(path.join(projectRoot, ".autoxeo/state/plugin-v1.json"), "utf8"))).toMatchObject({ schemaVersion: 1, mode: "cloud" });
    expect(state.mode).toBe("cloud");
  });
});
