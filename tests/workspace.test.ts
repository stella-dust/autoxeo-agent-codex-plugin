import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTaskLayout,
  createWorkspace,
  displayWorkspaceRoot,
  loadWorkspaceSelection,
  readWorkspace,
  saveWorkspaceSelection,
  WORKSPACE_SCHEMA_VERSION,
} from "../src/workspace.js";

describe("AutoXEO Workspace", () => {
  const roots: string[] = [];
  afterEach(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); roots.length = 0; });

  it("does not create a workspace while no user selection exists", async () => {
    const container = await mkdtemp(path.join(tmpdir(), "autoxeo-unconfigured-")); roots.push(container);
    const pluginData = path.join(container, "plugin-data");
    await expect(loadWorkspaceSelection(pluginData)).resolves.toBeUndefined();
    await expect(stat(path.join(container, "AutoXEO_Workspace"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("creates the Chinese workspace only after an explicit create call", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "autoxeo-workspace-")); roots.push(parent);
    const workspace = await createWorkspace(parent);
    expect(workspace.manifest.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(workspace.layoutLanguage).toBe("zh-CN");
    const task = await createTaskLayout(workspace.root, "task-001", "品牌基线");
    await expect(stat(path.join(workspace.root, "品牌知识库", "实体"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspace.root, task, "问题库", "冻结版本"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspace.root, task, "分析", "复测"))).resolves.toMatchObject({});
    expect(await readFile(path.join(workspace.root, "模板", "阶段", "基线分析模板.md"), "utf8")).toContain("Evidence");
  });

  it("persists a user selection only after creation or explicit connection", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "autoxeo-selection-")); roots.push(parent);
    const workspace = await createWorkspace(parent);
    const pluginData = path.join(parent, "plugin-data");
    await saveWorkspaceSelection(pluginData, workspace.root);
    await expect(loadWorkspaceSelection(pluginData)).resolves.toMatchObject({ root: workspace.root, layoutLanguage: "zh-CN" });
  });

  it("accepts an explicitly selected legacy workspace without renaming it", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "legacy-parent-")); roots.push(root);
    const workspaceRoot = path.join(root, "AutoXEO_Workspace");
    await mkdir(path.join(workspaceRoot, ".autoxeo"), { recursive: true });
    await writeFile(path.join(workspaceRoot, ".autoxeo", "workspace.json"), JSON.stringify({
      schemaVersion: "2026-08-09.workspace.v1",
      workspaceId: "dac453d0-7160-45f2-b79b-77ee1a89681b",
      createdAt: "2026-08-22T00:00:00.000Z",
      lastMigratedAt: "2026-08-22T00:00:00.000Z",
      paths: { knowledge: "brand-wiki", tasks: "questions", memory: "memory", templates: "templates" },
    }), "utf8");
    await expect(readWorkspace(workspaceRoot)).resolves.toMatchObject({ layoutLanguage: "legacy-en" });
    await expect(stat(path.join(workspaceRoot, "品牌知识库"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("uses a readable home-relative path after selection", () => {
    expect(displayWorkspaceRoot(path.join(process.env.HOME ?? "", "Documents", "AutoXEO_Workspace"))).toBe("~/Documents/AutoXEO_Workspace");
  });
});
