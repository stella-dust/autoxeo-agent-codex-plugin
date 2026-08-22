import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const WORKSPACE_SCHEMA_VERSION = "2026-08-09.workspace.v1" as const;
export const DESKTOP_WORKSPACE_SCHEMA_VERSION = "autoxeo-workspace.v1" as const;

const directories = [
  ".autoxeo/state",
  ".autoxeo/index",
  ".autoxeo/sync/checkpoints",
  ".autoxeo/recovery",
  "brand-wiki/entities",
  "brand-wiki/evidence",
  "questions/drafts",
  "questions/frozen",
  "collections/datasets",
  "analysis/baselines",
  "analysis/retests",
  "deliverables",
  "memory/operator",
  "memory/workspace",
  "tasks",
  "templates/knowledge",
  "templates/stages",
  "exports",
] as const;

const templates: Record<string, string> = {
  "README.md": "# AutoXEO Workspace\n\n本目录由 AutoXEO for Codex 管理。Brand Wiki、问题集、分析与交付物均为可读、可版本化文件。Codex 当前会话负责推理，Cloud 只负责账号与官方平台采集；任何 Provider Key 都不会写入本目录。\n",
  "memory/operator/preferences.md": "# 操作偏好\n\n记录经用户确认、可跨任务复用的偏好。不要记录密钥、Token 或敏感个人信息。\n",
  "memory/workspace/decisions.md": "# Workspace 决策记录\n\n记录目录迁移、命名和方法版本决策。\n",
  "brand-wiki/index.md": "---\nschema_version: autoxeo-brand-wiki.v1\nstatus: draft\nbrand: \"\"\nupdated_at: \"\"\n---\n\n# Brand Wiki\n\n## 品牌实体\n\n## 产品与服务\n\n## 受众与场景\n\n## 差异化事实\n\n## 来源索引\n\n## 禁止推断\n",
  "brand-wiki/evidence/registry.json": "{\n  \"schemaVersion\": \"autoxeo-evidence-registry.v1\",\n  \"sources\": []\n}\n",
  "templates/knowledge/wiki-page.md": "---\ntitle: \"\"\nentity_type: \"\"\nstatus: draft\nsource_refs: []\nupdated_at: \"\"\n---\n\n# 实体名称\n\n## 可引用事实\n\n## 关系与别名\n\n## 来源与边界\n",
  "templates/stages/question-set.md": "# GEO 问题集\n\n方法版本：geo-question-method-2026-08\n\n## 业务关键词\n\n## 证据范围\n\n## 问题分布\n\n## 冻结记录\n",
  "templates/stages/baseline-analysis.md": "# GEO 基线分析\n\n## 范围与 Evidence\n\n## 确定性指标\n\n## Codex 解释\n\n## 差距与行动\n\n## 限制与复测协议\n",
  "templates/stages/retest-analysis.md": "# GEO 同题复测\n\n## 基线与复测可比性\n\n## 变化事实\n\n## 归因假设\n\n## 保留与调整\n\n## 下一复测窗口\n",
};

export interface PluginWorkspaceManifest {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  workspaceId: string;
  createdAt: string;
  lastMigratedAt: string;
  paths: { knowledge: "brand-wiki"; tasks: "questions"; memory: "memory"; templates: "templates" };
}

export interface DesktopWorkspaceManifest {
  schemaVersion: typeof DESKTOP_WORKSPACE_SCHEMA_VERSION;
  workspaceId: string;
  createdAt: string;
  migratedAt: string | null;
  updatedAt: string;
  organizationId: string;
  rootDirectoryName: "AutoXEO_Workspace";
  layout: {
    tasks: "tasks";
    knowledge: "knowledge";
    brands: "knowledge/brands";
    memory: "memory";
    templates: "templates";
    exports: "exports";
  };
}

export type WorkspaceManifest = PluginWorkspaceManifest | DesktopWorkspaceManifest;

export function defaultWorkspaceRoot(): string {
  return path.join(os.homedir(), "Documents", "AutoXEO_Workspace");
}

export function displayWorkspaceRoot(root: string): string {
  const home = os.homedir();
  if (root === home) return "~";
  if (root.startsWith(`${home}${path.sep}`)) {
    return `~/${path.relative(home, root).split(path.sep).join("/")}`;
  }
  return root;
}

export function resolveWorkspaceRoot(value?: string): string {
  if (!value) return defaultWorkspaceRoot();
  const selected = path.resolve(value);
  return path.basename(selected) === "AutoXEO_Workspace" ? selected : path.join(selected, "AutoXEO_Workspace");
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporary, filePath);
}

export async function ensureWorkspace(root: string): Promise<WorkspaceManifest> {
  await mkdir(root, { recursive: true, mode: 0o700 });
  await Promise.all(directories.map((directory) => mkdir(path.join(root, directory), { recursive: true, mode: 0o700 })));

  const manifestPath = path.join(root, ".autoxeo", "workspace.json");
  let manifest: WorkspaceManifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as WorkspaceManifest;
    if (
      manifest.schemaVersion !== WORKSPACE_SCHEMA_VERSION &&
      manifest.schemaVersion !== DESKTOP_WORKSPACE_SCHEMA_VERSION
    ) {
      throw new Error("WORKSPACE_MIGRATION_REQUIRED");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const timestamp = new Date().toISOString();
    manifest = {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      workspaceId: randomUUID(),
      createdAt: timestamp,
      lastMigratedAt: timestamp,
      paths: { knowledge: "brand-wiki", tasks: "questions", memory: "memory", templates: "templates" },
    };
    await writeAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  await Promise.all(Object.entries(templates).map(async ([relativePath, content]) => {
    try {
      await writeAtomic(path.join(root, relativePath), content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }));
  return manifest;
}

export async function createTaskLayout(root: string, taskId: string, slug: string): Promise<string> {
  const safeSlug = slug.normalize("NFKC").replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "geo-task";
  const relative = path.join("tasks", `${taskId}-${safeSlug}`);
  const base = path.join(root, relative);
  const taskDirectories = [
    "brief",
    "questions/drafts",
    "questions/frozen",
    "collections/datasets",
    "analysis/baselines",
    "analysis/retests",
    "deliverables/drafts",
    "deliverables/approved",
    "conversations",
    "attachments",
    ".autoxeo/checkpoints",
    ".autoxeo/temp",
  ];
  await Promise.all(taskDirectories.map((directory) => mkdir(path.join(base, directory), { recursive: true, mode: 0o700 })));
  return relative;
}
