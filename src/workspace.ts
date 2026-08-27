import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export const WORKSPACE_DIRECTORY_NAME = "AutoXEO_Workspace" as const;
export const WORKSPACE_SCHEMA_VERSION = "2026-08-28.workspace.v2" as const;
export const LEGACY_PLUGIN_WORKSPACE_SCHEMA_VERSION = "2026-08-09.workspace.v1" as const;
export const DESKTOP_WORKSPACE_SCHEMA_VERSION = "autoxeo-workspace.v1" as const;

const execFileAsync = promisify(execFile);
const selectionFileName = "workspace-selection.json";

const directories = [
  ".autoxeo/state",
  ".autoxeo/index",
  ".autoxeo/sync/checkpoints",
  ".autoxeo/recovery",
  "品牌知识库/实体",
  "品牌知识库/证据",
  "问题库/草稿",
  "问题库/冻结版本",
  "采集数据/数据集",
  "分析/基线",
  "分析/复测",
  "交付物",
  "记忆/操作员",
  "记忆/工作区",
  "任务",
  "模板/知识库",
  "模板/阶段",
  "导出",
] as const;

const templates: Record<string, string> = {
  "README.md": "# AutoXEO 工作区\n\n本目录由 AutoXEO for Codex 管理。品牌知识库、问题集、分析与交付物均为可读、可版本化文件。Codex 当前会话负责推理，Cloud 只负责账号与官方平台采集；任何 Provider Key 都不会写入本目录。\n",
  "记忆/操作员/偏好.md": "# 操作偏好\n\n记录经用户确认、可跨任务复用的偏好。不要记录密钥、Token 或敏感个人信息。\n",
  "记忆/工作区/决策记录.md": "# 工作区决策记录\n\n记录目录迁移、命名和方法版本决策。\n",
  "品牌知识库/索引.md": "---\nschema_version: autoxeo-brand-wiki.v1\nstatus: draft\nbrand: \"\"\nupdated_at: \"\"\n---\n\n# 品牌知识库（Brand Wiki）\n\n## 品牌实体\n\n## 产品与服务\n\n## 受众与场景\n\n## 差异化事实\n\n## 来源索引\n\n## 禁止推断\n",
  "品牌知识库/证据/登记册.json": "{\n  \"schemaVersion\": \"autoxeo-evidence-registry.v1\",\n  \"sources\": []\n}\n",
  "模板/知识库/实体页模板.md": "---\ntitle: \"\"\nentity_type: \"\"\nstatus: draft\nsource_refs: []\nupdated_at: \"\"\n---\n\n# 实体名称\n\n## 可引用事实\n\n## 关系与别名\n\n## 来源与边界\n",
  "模板/阶段/问题集模板.md": "# GEO 问题集\n\n方法版本：geo-question-method-2026-08\n\n## 业务关键词\n\n## 证据范围\n\n## 问题分布\n\n## 冻结记录\n",
  "模板/阶段/基线分析模板.md": "# GEO 基线分析\n\n## 范围与 Evidence\n\n## 确定性指标\n\n## Codex 解释\n\n## 差距与行动\n\n## 限制与复测协议\n",
  "模板/阶段/复测分析模板.md": "# GEO 同题复测\n\n## 基线与复测可比性\n\n## 变化事实\n\n## 归因假设\n\n## 保留与调整\n\n## 下一复测窗口\n",
};

export interface ChineseWorkspaceManifest {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  workspaceId: string;
  createdAt: string;
  lastMigratedAt: string;
  layoutLanguage: "zh-CN";
  paths: {
    knowledge: "品牌知识库";
    questions: "问题库";
    collections: "采集数据";
    analysis: "分析";
    deliverables: "交付物";
    memory: "记忆";
    tasks: "任务";
    templates: "模板";
    exports: "导出";
  };
}

export interface LegacyPluginWorkspaceManifest {
  schemaVersion: typeof LEGACY_PLUGIN_WORKSPACE_SCHEMA_VERSION;
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
  layout: Record<string, string>;
}

export type WorkspaceManifest = ChineseWorkspaceManifest | LegacyPluginWorkspaceManifest | DesktopWorkspaceManifest;
export type WorkspaceLayoutLanguage = "zh-CN" | "legacy-en";

export interface WorkspaceConnection {
  root: string;
  manifest: WorkspaceManifest;
  layoutLanguage: WorkspaceLayoutLanguage;
}

function expandHome(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith(`~${path.sep}`) || trimmed.startsWith("~/")) return path.join(os.homedir(), trimmed.slice(2));
  return trimmed;
}

export function displayWorkspaceRoot(root: string): string {
  const home = os.homedir();
  if (root === home) return "~";
  if (root.startsWith(`${home}${path.sep}`)) return `~/${path.relative(home, root).split(path.sep).join("/")}`;
  return root;
}

export function resolveWorkspaceRoot(value: string): string {
  const expanded = expandHome(value);
  if (!path.isAbsolute(expanded)) throw new Error("WORKSPACE_PATH_MUST_BE_ABSOLUTE");
  const selected = path.resolve(expanded);
  return path.basename(selected) === WORKSPACE_DIRECTORY_NAME ? selected : path.join(selected, WORKSPACE_DIRECTORY_NAME);
}

function layoutLanguage(manifest: WorkspaceManifest): WorkspaceLayoutLanguage {
  return manifest.schemaVersion === WORKSPACE_SCHEMA_VERSION ? "zh-CN" : "legacy-en";
}

function assertManifest(value: unknown): WorkspaceManifest {
  if (!value || typeof value !== "object") throw new Error("WORKSPACE_MANIFEST_INVALID");
  const manifest = value as Partial<WorkspaceManifest>;
  if (
    manifest.schemaVersion !== WORKSPACE_SCHEMA_VERSION &&
    manifest.schemaVersion !== LEGACY_PLUGIN_WORKSPACE_SCHEMA_VERSION &&
    manifest.schemaVersion !== DESKTOP_WORKSPACE_SCHEMA_VERSION
  ) throw new Error("WORKSPACE_MIGRATION_REQUIRED");
  if (typeof manifest.workspaceId !== "string" || !manifest.workspaceId) throw new Error("WORKSPACE_MANIFEST_INVALID");
  return manifest as WorkspaceManifest;
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporary, filePath);
}

export async function readWorkspace(root: string): Promise<WorkspaceConnection> {
  const resolved = await realpath(root);
  const metadata = await stat(resolved);
  if (!metadata.isDirectory()) throw new Error("WORKSPACE_NOT_A_DIRECTORY");
  if (path.basename(resolved) !== WORKSPACE_DIRECTORY_NAME) throw new Error("WORKSPACE_DIRECTORY_NAME_REQUIRED");
  const manifest = assertManifest(JSON.parse(await readFile(path.join(resolved, ".autoxeo", "workspace.json"), "utf8")));
  return { root: resolved, manifest, layoutLanguage: layoutLanguage(manifest) };
}

export async function createWorkspace(parentPath: string): Promise<WorkspaceConnection> {
  const parentCandidate = expandHome(parentPath);
  if (!path.isAbsolute(parentCandidate)) throw new Error("WORKSPACE_PATH_MUST_BE_ABSOLUTE");
  const parent = await realpath(parentCandidate);
  if (!(await stat(parent)).isDirectory()) throw new Error("WORKSPACE_PARENT_NOT_A_DIRECTORY");
  const root = resolveWorkspaceRoot(parent);

  try {
    const metadata = await stat(root);
    if (!metadata.isDirectory()) throw new Error("WORKSPACE_PATH_OCCUPIED");
    const entries = await readdir(root);
    if (entries.length > 0) throw new Error("WORKSPACE_ALREADY_EXISTS");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await mkdir(root, { recursive: true, mode: 0o700 });
  await Promise.all(directories.map((directory) => mkdir(path.join(root, directory), { recursive: true, mode: 0o700 })));
  const timestamp = new Date().toISOString();
  const manifest: ChineseWorkspaceManifest = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: randomUUID(),
    createdAt: timestamp,
    lastMigratedAt: timestamp,
    layoutLanguage: "zh-CN",
    paths: {
      knowledge: "品牌知识库",
      questions: "问题库",
      collections: "采集数据",
      analysis: "分析",
      deliverables: "交付物",
      memory: "记忆",
      tasks: "任务",
      templates: "模板",
      exports: "导出",
    },
  };
  await writeAtomic(path.join(root, ".autoxeo", "workspace.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await Promise.all(Object.entries(templates).map(([relativePath, content]) => writeAtomic(path.join(root, relativePath), content)));
  return { root, manifest, layoutLanguage: "zh-CN" };
}

export async function saveWorkspaceSelection(pluginDataRoot: string, root: string): Promise<void> {
  await writeAtomic(path.join(pluginDataRoot, selectionFileName), `${JSON.stringify({ root, selectedAt: new Date().toISOString() }, null, 2)}\n`);
}

export async function loadWorkspaceSelection(pluginDataRoot: string, configuredRoot?: string): Promise<WorkspaceConnection | undefined> {
  let selected = configuredRoot;
  try {
    const value = JSON.parse(await readFile(path.join(pluginDataRoot, selectionFileName), "utf8")) as { root?: unknown };
    if (typeof value.root === "string") selected = value.root;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!selected) return undefined;
  try {
    return await readWorkspace(resolveWorkspaceRoot(selected));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function chooseLocalDirectory(prompt: string): Promise<string> {
  if (process.platform !== "darwin") throw new Error("NATIVE_FOLDER_PICKER_UNAVAILABLE");
  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", [
      "-e",
      `POSIX path of (choose folder with prompt ${JSON.stringify(prompt)})`,
    ], { timeout: 120_000 });
    return (await realpath(stdout.trim())).replace(/[\\/]$/, "");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ETIMEDOUT") throw new Error("FOLDER_PICKER_TIMEOUT");
    throw new Error("FOLDER_SELECTION_CANCELLED");
  }
}

export async function createTaskLayout(root: string, taskId: string, slug: string): Promise<string> {
  const safeSlug = slug.normalize("NFKC").replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "GEO任务";
  const relative = path.join("任务", `${taskId}-${safeSlug}`);
  const base = path.join(root, relative);
  const taskDirectories = [
    "简报",
    "问题库/草稿",
    "问题库/冻结版本",
    "采集数据/数据集",
    "分析/基线",
    "分析/复测",
    "交付物/草稿",
    "交付物/已批准",
    "对话记录",
    "附件",
    ".autoxeo/checkpoints",
    ".autoxeo/temp",
  ];
  await Promise.all(taskDirectories.map((directory) => mkdir(path.join(base, directory), { recursive: true, mode: 0o700 })));
  return relative;
}
