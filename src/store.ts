import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROTOCOL_VERSION, projectStateSchema, type Activity, type Artifact, type ArtifactKind, type ProjectState } from "./contracts.js";
import { safeDisplayRoot } from "./security.js";
import { ensureWorkspace } from "./workspace.js";

const stateRelativePath = path.join(".autoxeo", "state", "plugin-v2.json");
const artifactExtensions = new Map([[".md", "text/markdown"], [".markdown", "text/markdown"], [".json", "application/json"], [".csv", "text/csv"], [".html", "text/html"]] as const);
type ArtifactExtension = ".md" | ".markdown" | ".json" | ".csv" | ".html";
const skippedDirectories = new Set([".git", ".autoxeo", "node_modules", "dist", "coverage"]);

function now(): string { return new Date().toISOString(); }

function seedState(projectRoot: string): ProjectState {
  const timestamp = now();
  return {
    schemaVersion: 2,
    protocolVersion: PROTOCOL_VERSION,
    revision: 1,
    project: { localRootName: safeDisplayRoot(projectRoot), cloudId: null, cloudName: null },
    organization: null,
    brand: { id: null, name: null, wiki: { status: "missing", root: "brand-wiki", entryCount: 0, evidenceCount: 0 } },
    credit: { available: 0, reserved: 0, currency: "CREDIT", authoritative: false },
    task: { title: "首个 GEO 研究", budget: 0, estimatedCost: 0 },
    collection: { status: "blocked", questionSetId: null, jobId: null, receiptId: null, provenance: "unavailable", nextAction: "先在 Codex 中建立 Brand Wiki 和问题集", updatedAt: timestamp },
    artifacts: [],
    activity: [{ id: randomUUID(), type: "system", title: "Codex 工作区已就绪", detail: "推理与产物在当前 Codex 会话和本地工作区完成；官方采集需连接 AutoXEO Cloud。", status: "info", occurredAt: timestamp }],
    updatedAt: timestamp,
  };
}

function kindForPath(relativePath: string): ArtifactKind {
  const normalized = relativePath.split(path.sep).join("/");
  if (normalized.startsWith("brand-wiki/")) return "brand_wiki";
  if (normalized.startsWith("questions/")) return "question_set";
  if (normalized.startsWith("collections/")) return "collection_dataset";
  if (normalized.startsWith("analysis/retests/")) return "retest_analysis";
  if (normalized.startsWith("analysis/")) return "baseline_analysis";
  if (normalized.startsWith("deliverables/") || normalized.startsWith("exports/")) return "deliverable";
  return "other";
}

export class ProjectStore {
  private state: ProjectState | undefined;
  private readonly statePath: string;

  constructor(readonly projectRoot: string) { this.statePath = path.join(projectRoot, stateRelativePath); }

  async load(): Promise<ProjectState> {
    if (this.state) return structuredClone(this.state);
    await ensureWorkspace(this.projectRoot);
    try {
      this.state = projectStateSchema.parse(JSON.parse(await readFile(this.statePath, "utf8")));
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
      const wikiArtifacts = artifacts.filter((item) => item.kind === "brand_wiki");
      if (JSON.stringify(artifacts) !== JSON.stringify(this.state?.artifacts)) {
        await this.update((draft) => {
          draft.artifacts = artifacts;
          draft.brand.wiki.entryCount = wikiArtifacts.filter((item) => item.relativePath.includes("/entities/")).length;
          draft.brand.wiki.evidenceCount = wikiArtifacts.filter((item) => item.relativePath.includes("/evidence/")).length;
          draft.brand.wiki.status = wikiArtifacts.some((item) => item.relativePath === "brand-wiki/index.md" && item.bytes > 260) ? "draft" : "missing";
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
    return this.update((draft) => { draft.activity.unshift({ ...activity, id: randomUUID(), occurredAt: now() }); draft.activity = draft.activity.slice(0, 50); });
  }

  private requireState(): ProjectState { if (!this.state) throw new Error("STATE_NOT_LOADED"); return this.state; }

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
      if (depth > 5 || results.length >= 300) return;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (results.length >= 300) return;
        if (entry.name.startsWith(".") || skippedDirectories.has(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) { await walk(absolute, depth + 1); continue; }
        if (!entry.isFile()) continue;
        const extension = path.extname(entry.name).toLowerCase() as ArtifactExtension;
        const mediaType = artifactExtensions.get(extension);
        if (!mediaType) continue;
        const metadata = await stat(absolute);
        if (metadata.size > 2_000_000) continue;
        const relativePath = path.relative(this.projectRoot, absolute);
        const digest = createHash("sha256").update(await readFile(absolute)).digest("hex");
        results.push({ id: digest.slice(0, 16), name: entry.name, relativePath, kind: kindForPath(relativePath), mediaType, bytes: metadata.size, sha256: digest, provenance: "local_artifact", createdAt: metadata.mtime.toISOString() });
      }
    };
    await walk(this.projectRoot, 0);
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
