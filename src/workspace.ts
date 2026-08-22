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
  "knowledge/brands",
  "memory/operator",
  "memory/workspace",
  "tasks",
  "templates/knowledge",
  "templates/stages",
  "exports",
] as const;

const templates: Record<string, string> = {
  "README.md": "# AutoXEO Workspace\n\n本目录由 AutoXEO Agent 管理。知识库、GEO 六节点产物和报告均使用可读文件保存；Cloud 凭据与平台 API Key 不写入本目录。\n",
  "memory/operator/preferences.md": "# 操作偏好\n\n记录经用户确认、可跨任务复用的偏好。不要记录密钥、Token 或敏感个人信息。\n",
  "memory/workspace/decisions.md": "# Workspace 决策记录\n\n记录目录迁移、命名和方法版本决策。\n",
  "templates/knowledge/wiki-page.md": "---\ntitle: \"\"\nstatus: draft\nsource_refs: []\nupdated_at: \"\"\n---\n\n# 标题\n\n## 可引用事实\n\n## 来源与边界\n",
  "templates/stages/01-question-research.md": "# 问题研究\n\n## 业务目标\n\n## 受众与意图\n\n## 冻结问题集\n\n## 版本与审批\n",
  "templates/stages/02-platform-capture.md": "# 平台采集\n\n## 冻结问题版本\n\n## 平台与模型\n\n## Evidence / Receipt\n\n## 失败与重试\n",
  "templates/stages/03-metric-analysis.md": "# 指标分析\n\n## 数据范围与 provenance\n\n## 方法版本\n\n## 指标与结论\n\n## 限制\n",
  "templates/stages/04-content-production.md": "# 内容生产\n\n## Brief\n\n## 草稿\n\n## 审核结论\n\n## 已批准版本\n",
  "templates/stages/05-distribution.md": "# 投放任务\n\n## 目标与负责人\n\n## 已批准内容\n\n## 执行回执\n\n## 未完成事项\n",
  "templates/stages/06-same-question-retest.md": "# 同题复测\n\n## 基线批次\n\n## 冻结问题版本\n\n## 复测批次\n\n## 差异与结论\n",
};

export interface PluginWorkspaceManifest {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  workspaceId: string;
  createdAt: string;
  lastMigratedAt: string;
  paths: { knowledge: "knowledge"; tasks: "tasks"; memory: "memory"; templates: "templates" };
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
      paths: { knowledge: "knowledge", tasks: "tasks", memory: "memory", templates: "templates" },
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
    "01-question-research/versions",
    "02-platform-capture/batches",
    "03-metric-analysis",
    "04-content-production/briefs",
    "04-content-production/drafts",
    "04-content-production/reviews",
    "04-content-production/approved",
    "05-distribution/targets",
    "05-distribution/receipts",
    "06-same-question-retest/batches",
    "reports",
    "conversations",
    "attachments",
    ".autoxeo/checkpoints",
    ".autoxeo/temp",
  ];
  await Promise.all(taskDirectories.map((directory) => mkdir(path.join(base, directory), { recursive: true, mode: 0o700 })));
  return relative;
}
