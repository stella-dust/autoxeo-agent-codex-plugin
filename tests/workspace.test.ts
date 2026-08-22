import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTaskLayout, ensureWorkspace, resolveWorkspaceRoot, WORKSPACE_SCHEMA_VERSION } from "../src/workspace.js";

describe("AutoXEO Workspace", () => {
  const roots: string[] = [];
  afterEach(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); roots.length = 0; });

  it("creates the Codex-native workspace and research task layout", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "autoxeo-workspace-")); roots.push(parent);
    const root = resolveWorkspaceRoot(parent);
    const manifest = await ensureWorkspace(root);
    expect(manifest.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    const task = await createTaskLayout(root, "task-001", "品牌基线");
    await expect(stat(path.join(root, task, "questions/frozen"))).resolves.toMatchObject({});
    await expect(stat(path.join(root, task, "analysis/retests"))).resolves.toMatchObject({});
    expect(await readFile(path.join(root, "templates/stages/baseline-analysis.md"), "utf8")).toContain("Evidence");
  });

  it("accepts the tenant-bound Desktop workspace manifest", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "autoxeo-desktop-workspace-"));
    roots.push(root);
    await mkdir(path.join(root, ".autoxeo"), { recursive: true });
    await writeFile(
      path.join(root, ".autoxeo", "workspace.json"),
      JSON.stringify({
        schemaVersion: "autoxeo-workspace.v1",
        workspaceId: "dac453d0-7160-45f2-b79b-77ee1a89681b",
        createdAt: "2026-08-09T09:15:51.170Z",
        migratedAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
        organizationId: "org_customer",
        rootDirectoryName: "AutoXEO_Workspace",
        layout: {
          tasks: "tasks",
          knowledge: "knowledge",
          brands: "knowledge/brands",
          memory: "memory",
          templates: "templates",
          exports: "exports",
        },
      }),
      "utf8",
    );

    await expect(ensureWorkspace(root)).resolves.toMatchObject({
      schemaVersion: "autoxeo-workspace.v1",
      organizationId: "org_customer",
    });
  });
});
