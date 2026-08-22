import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PROTOCOL_VERSION,
  projectStateSchema,
  type Activity,
  type Artifact,
  type GeoNode,
  type KnowledgeEntry,
  type ProjectState,
} from "./contracts.js";
import { safeDisplayRoot } from "./security.js";
import { ensureWorkspace } from "./workspace.js";

const stateRelativePath = path.join(".autoxeo", "state", "plugin-v1.json");
const artifactExtensions = new Map([
  [".md", "text/markdown"],
  [".markdown", "text/markdown"],
  [".json", "application/json"],
  [".csv", "text/csv"],
  [".html", "text/html"],
] as const);
type ArtifactExtension = ".md" | ".markdown" | ".json" | ".csv" | ".html";
const skippedDirectories = new Set([".git", ".autoxeo", "node_modules", "dist", "coverage"]);

function now(): string {
  return new Date().toISOString();
}

function seedNodes(timestamp: string): GeoNode[] {
  return [
    {
      kind: "question_research",
      title: "问题研究",
      status: "ready",
      summary: "在本地模板中整理业务目标、受众和可复测问题。",
      nextAction: "建立首个问题集",
      artifactCount: 0,
      updatedAt: timestamp,
    },
    {
      kind: "platform_capture",
      title: "平台采集",
      status: "blocked",
      summary: "等待问题版本冻结和 AutoXEO Cloud 能力预检。",
      nextAction: "完成问题研究并登录 AutoXEO 账号",
      artifactCount: 0,
      updatedAt: timestamp,
    },
    {
      kind: "metric_analysis",
      title: "指标分析",
      status: "blocked",
      summary: "等待 official_api observed 回答批次。",
      nextAction: "完成平台采集",
      artifactCount: 0,
      updatedAt: timestamp,
    },
    {
      kind: "content_production",
      title: "内容生产",
      status: "blocked",
      summary: "等待分析结论或人工 Brief。",
      nextAction: "提供分析 Artifact",
      artifactCount: 0,
      updatedAt: timestamp,
    },
    {
      kind: "distribution_task",
      title: "投放任务",
      status: "not_selected",
      summary: "插件仅登记投放事实，不自动替用户发布。",
      nextAction: "选择节点并提供已批准内容",
      artifactCount: 0,
      updatedAt: timestamp,
    },
    {
      kind: "same_question_retest",
      title: "同题复测",
      status: "not_selected",
      summary: "需冻结问题版本、基线批次和复测窗口。",
      nextAction: "选择基线批次",
      artifactCount: 0,
      updatedAt: timestamp,
    },
  ];
}

function seedKnowledge(): KnowledgeEntry[] { return []; }

function seedState(projectRoot: string): ProjectState {
  const timestamp = now();
  return {
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    revision: 1,
    mode: "cloud",
    project: { id: "workspace-local", name: "AutoXEO Workspace", rootName: safeDisplayRoot(projectRoot) },
    organization: { id: "unbound", name: "尚未绑定 AutoXEO 组织" },
    brand: {
      id: "brand-unbound",
      name: "尚未创建品牌知识库",
      publicationId: null,
      publicationStatus: "missing",
      completeness: 0,
    },
    credit: { available: 0, reserved: 0, currency: "CREDIT", authoritative: false },
    task: {
      id: "task-unbound",
      title: "开始第一个 GEO 项目",
      status: "ready",
      nextAction: "建立品牌知识库与问题集",
      budget: 0,
      estimatedCost: 0,
    },
    nodes: seedNodes(timestamp),
    knowledge: seedKnowledge(),
    artifacts: [],
    activity: [
      {
        id: randomUUID(),
        type: "system",
        title: "AutoXEO Workspace 已就绪",
        detail: "本地产物可立即使用；Cloud、Credit 和正式采集需登录官网账号。",
        status: "info",
        occurredAt: timestamp,
      },
    ],
    updatedAt: timestamp,
  };
}

export class ProjectStore {
  private state: ProjectState | undefined;
  private readonly statePath: string;

  constructor(
    readonly projectRoot: string,
    private readonly mode: ProjectState["mode"] = "cloud",
  ) {
    this.statePath = path.join(projectRoot, stateRelativePath);
  }

  async load(): Promise<ProjectState> {
    if (this.state) return structuredClone(this.state);
    await ensureWorkspace(this.projectRoot);
    try {
      const parsed: unknown = JSON.parse(await readFile(this.statePath, "utf8"));
      this.state = projectStateSchema.parse(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof Error && error.name === "ZodError")) throw error;
      this.state = seedState(this.projectRoot);
      await this.persist();
    }
    return structuredClone(this.state);
  }

  async snapshot(options: { refreshArtifacts?: boolean } = {}): Promise<ProjectState> {
    await this.load();
    if (options.refreshArtifacts) {
      const artifacts = await this.scanArtifacts();
      if (JSON.stringify(artifacts) !== JSON.stringify(this.state?.artifacts)) {
        await this.update((draft) => {
          draft.artifacts = artifacts;
        });
      }
    }
    return structuredClone(this.requireState());
  }

  async update(mutator: (draft: ProjectState) => void): Promise<ProjectState> {
    await this.load();
    const draft = structuredClone(this.requireState());
    mutator(draft);
    draft.revision += 1;
    draft.updatedAt = now();
    this.state = projectStateSchema.parse(draft);
    await this.persist();
    return structuredClone(this.state);
  }

  async addActivity(activity: Omit<Activity, "id" | "occurredAt">): Promise<ProjectState> {
    return this.update((draft) => {
      draft.activity.unshift({ ...activity, id: randomUUID(), occurredAt: now() });
      draft.activity = draft.activity.slice(0, 50);
    });
  }

  private requireState(): ProjectState {
    if (!this.state) throw new Error("STATE_NOT_LOADED");
    return this.state;
  }

  private async persist(): Promise<void> {
    if (!this.state) return;
    await mkdir(path.dirname(this.statePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.statePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.statePath);
  }

  private async scanArtifacts(): Promise<Artifact[]> {
    const results: Artifact[] = [];
    const walk = async (directory: string, depth: number): Promise<void> => {
      if (depth > 4 || results.length >= 200) return;
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= 200) return;
        if (entry.name.startsWith(".") || skippedDirectories.has(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await walk(absolute, depth + 1);
          continue;
        }
        if (!entry.isFile()) continue;
        const extension = path.extname(entry.name).toLowerCase() as ArtifactExtension;
        const mediaType = artifactExtensions.get(extension);
        if (!mediaType) continue;
        const metadata = await stat(absolute);
        if (metadata.size > 2_000_000) continue;
        const relativePath = path.relative(this.projectRoot, absolute);
        const digest = createHash("sha256").update(await readFile(absolute)).digest("hex");
        results.push({
          id: digest.slice(0, 16),
          name: entry.name,
          relativePath,
          mediaType,
          bytes: metadata.size,
          sha256: digest,
          provenance: "local_artifact",
          createdAt: metadata.mtime.toISOString(),
        });
      }
    };
    await walk(this.projectRoot, 0);
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
