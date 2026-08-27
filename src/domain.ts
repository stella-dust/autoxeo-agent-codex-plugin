import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import type { AuthSession } from "./auth-session.js";
import type { AccountOverview, CloudClient, ConnectionStatus } from "./cloud-client.js";
import { artifactRegistrationSchema, cloudProjectSelectionSchema, collectionRequestSchema, PROTOCOL_VERSION, questionSetSchema } from "./contracts.js";
import type { ArtifactRegistration, CollectionRequest, ProjectState, QuestionSet, SetupGuide } from "./contracts.js";
import { PLUGIN_VERSION, type RuntimeConfig } from "./config.js";
import { resolveSafeProjectFile, sha256 } from "./security.js";
import { ProjectStore } from "./store.js";
import {
  chooseLocalDirectory,
  createWorkspace,
  displayWorkspaceRoot,
  loadWorkspaceSelection,
  readWorkspace,
  resolveWorkspaceRoot,
  saveWorkspaceSelection,
  type WorkspaceConnection,
} from "./workspace.js";

export interface DomainEvent { id: string; type: "state.changed" | "collection.changed"; occurredAt: string; revision: number }

function unconfiguredState(): ProjectState {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 2,
    protocolVersion: PROTOCOL_VERSION,
    revision: 0,
    project: { localRootName: "尚未选择工作区", cloudId: null, cloudName: null },
    organization: null,
    brand: { id: null, name: null, wiki: { status: "missing", root: "品牌知识库", entryCount: 0, evidenceCount: 0 } },
    credit: { available: 0, reserved: 0, currency: "CREDIT", authoritative: false },
    task: { title: "首个 GEO 研究", budget: 0, estimatedCost: 0 },
    collection: { status: "blocked", questionSetId: null, jobId: null, receiptId: null, provenance: "unavailable", nextAction: "先在本地工作台选择位置并创建工作区", updatedAt: timestamp },
    artifacts: [],
    activity: [],
    updatedAt: timestamp,
  };
}

export class WorkbenchDomain {
  readonly events = new EventEmitter();
  private workspace: WorkspaceConnection | undefined;
  private store: ProjectStore | undefined;

  constructor(readonly config: RuntimeConfig, readonly cloud: CloudClient, readonly auth: AuthSession) {}

  async initialize(): Promise<ProjectState> {
    try {
      const selected = await loadWorkspaceSelection(this.config.pluginDataRoot, this.config.configuredProjectRoot);
      if (selected) await this.attachWorkspace(selected);
    } catch {
      this.workspace = undefined;
      this.store = undefined;
    }
    return this.state(true);
  }

  connectionStatus(): Promise<ConnectionStatus> { return this.cloud.connectionStatus(); }
  accountOverview(): Promise<AccountOverview> { return this.cloud.accountOverview(); }
  state(refreshArtifacts = false): Promise<ProjectState> {
    return this.store ? this.store.snapshot({ refreshArtifacts }) : Promise.resolve(unconfiguredState());
  }

  async chooseWorkspaceParent(): Promise<{ parentPath: string; workspacePath: string }> {
    const parentPath = await chooseLocalDirectory("选择 AutoXEO_Workspace 的保存位置");
    return { parentPath: displayWorkspaceRoot(parentPath), workspacePath: displayWorkspaceRoot(resolveWorkspaceRoot(parentPath)) };
  }

  async createSelectedWorkspace(parentPath: string): Promise<SetupGuide> {
    const workspace = await createWorkspace(parentPath);
    await saveWorkspaceSelection(this.config.pluginDataRoot, workspace.root);
    await this.attachWorkspace(workspace);
    await this.emitState();
    return this.getStarted();
  }

  async chooseAndConnectExistingWorkspace(): Promise<SetupGuide> {
    const selected = await chooseLocalDirectory("选择已有的 AutoXEO_Workspace");
    const workspace = await readWorkspace(resolveWorkspaceRoot(selected));
    await saveWorkspaceSelection(this.config.pluginDataRoot, workspace.root);
    await this.attachWorkspace(workspace);
    await this.emitState();
    return this.getStarted();
  }

  async getStarted(): Promise<SetupGuide> {
    const workspaceReady = Boolean(this.workspace && this.store);
    const state = await this.state(workspaceReady);
    const account = this.auth.status();
    const signedIn = account.state === "signed_in";
    const wikiReady = workspaceReady && state.brand.wiki.status !== "missing";
    const projectBound = workspaceReady && Boolean(state.organization && state.project.cloudId);
    const questionsReady = workspaceReady && Boolean(state.collection.questionSetId);

    const nextAction: SetupGuide["nextAction"] = !workspaceReady
      ? {
          kind: "select_workspace",
          label: "选择工作区位置",
          description: "在本地工作台中选择父目录；只有再次确认后才会创建 AutoXEO_Workspace。",
        }
      : !wikiReady
        ? {
            kind: "copy_prompt",
            label: "复制品牌知识库提示",
            description: "先在当前 Codex 任务中整理真实品牌资料；这一步不需要登录 Cloud。",
            prompt: "请使用 AutoXEO 的品牌知识库 Skill，检查当前目录中的品牌资料，在“品牌知识库”目录建立可追溯 Brand Wiki，并明确来源、冲突与禁止推断。",
          }
        : account.state === "pending"
          ? {
              kind: "poll_account",
              label: "我已在官网批准",
              description: `在官网输入设备码 ${account.userCode} 并批准后，返回这里完成连接。`,
            }
          : !signedIn
            ? {
                kind: "connect_account",
                label: "连接 AutoXEO 账号",
                description: "使用官网已有账号完成一次设备授权，以访问组织、项目、Credit 与官方采集。",
              }
            : !projectBound
              ? {
                  kind: "bind_project",
                  label: "选择并绑定 Cloud 项目",
                  description: "选择当前品牌所属项目并设置本任务 Credit 上限；绑定本身不会扣费。",
                }
              : !questionsReady
                ? {
                    kind: "copy_prompt",
                    label: "复制问题集提示",
                    description: "让 Codex 基于品牌知识库生成、评审并冻结第一版可复测问题集。",
                    prompt: "请使用 AutoXEO 的 GEO 问题研究 Skill，基于当前品牌知识库生成、去重、评审并冻结第一版可复测问题集。",
                  }
                : {
                    kind: "open_collections",
                    label: "查看官方采集预检",
                    description: "问题集已经冻结，可以检查平台能力、Evidence 门与 Credit 预算。",
                  };

    const steps: SetupGuide["steps"] = [
      { id: "plugin", label: "Codex Plugin", detail: "已加载；启用不会创建任何工作区目录", state: "complete" },
      { id: "workspace", label: "本地工作区", detail: workspaceReady ? `${displayWorkspaceRoot(this.requireWorkspace().root)} · ${this.workspace?.layoutLanguage === "zh-CN" ? "中文目录规范" : "旧版英文目录兼容"}` : "等待你在本地工作台中选择位置并确认创建", state: workspaceReady ? "complete" : "current" },
      { id: "brand_wiki", label: "品牌知识库", detail: wikiReady ? `${state.brand.wiki.entryCount} 个实体 · ${state.brand.wiki.evidenceCount} 项证据` : workspaceReady ? "可先离线建立，不依赖 Cloud" : "创建工作区后开始", state: wikiReady ? "complete" : workspaceReady ? "current" : "upcoming" },
      { id: "account", label: "AutoXEO 账号", detail: signedIn ? "已通过官网设备授权连接" : account.state === "pending" ? `等待官网批准 · 设备码 ${account.userCode}` : "官方采集前需要；本地研究可稍后连接", state: signedIn ? "complete" : wikiReady ? "current" : "available", optionalForLocal: true },
      { id: "project", label: "Cloud 项目", detail: projectBound ? `${state.organization?.name} · ${state.project.cloudName}` : "登录后选择组织、品牌项目和 Credit 上限", state: projectBound ? "complete" : signedIn && workspaceReady ? "current" : "upcoming" },
      { id: "question_set", label: "可复测问题集", detail: questionsReady ? state.collection.questionSetId ?? "已冻结" : "基于品牌知识库生成、评审并冻结", state: questionsReady ? "complete" : wikiReady && projectBound ? "current" : "upcoming" },
    ];

    return {
      version: PLUGIN_VERSION,
      workspace: {
        state: workspaceReady ? "ready" : "not_configured",
        displayPath: workspaceReady ? displayWorkspaceRoot(this.requireWorkspace().root) : "尚未选择",
        createdAutomatically: false,
        layoutLanguage: this.workspace?.layoutLanguage ?? null,
        authority: "local_workspace",
      },
      progress: { completed: steps.filter((step) => step.state === "complete").length, total: steps.length },
      steps,
      nextAction,
    };
  }

  async bindCloudProject(raw: unknown): Promise<ProjectState> {
    const store = this.requireStore();
    const input = cloudProjectSelectionSchema.parse(raw);
    const overview = await this.cloud.accountOverview();
    const organization = overview.organizations.find((item) => item.id === input.organizationId);
    const project = organization?.projects.find((item) => item.id === input.projectId);
    if (!organization || !project) throw new Error("CLOUD_PROJECT_NOT_FOUND");
    if (input.taskBudget > organization.credit.available) throw new Error(`TASK_BUDGET_EXCEEDS_AVAILABLE_CREDIT: ${organization.credit.available}`);
    return this.change((draft) => {
      draft.organization = { id: organization.id, name: organization.name };
      draft.project.cloudId = project.id;
      draft.project.cloudName = project.name;
      draft.brand.id = project.brand.id;
      draft.brand.name = project.brand.name;
      draft.credit = { available: organization.credit.available, reserved: 0, currency: "CREDIT", authoritative: true };
      draft.task.budget = input.taskBudget;
      draft.collection.status = draft.collection.questionSetId ? "ready" : "blocked";
      draft.collection.nextAction = draft.collection.questionSetId ? "运行官方平台采集预检" : "在 Codex 中生成并冻结问题集";
      draft.activity.unshift({ id: randomUUID(), type: "account", title: "Cloud 项目已绑定", detail: `${organization.name} · ${project.name} · 任务预算 ${input.taskBudget} Credit`, status: "success", occurredAt: new Date().toISOString() });
    }, store);
  }

  async prepareQuestionSet(raw: unknown): Promise<unknown> {
    const store = this.requireStore();
    const input = questionSetSchema.parse(raw);
    this.assertUniqueQuestions(input);
    const state = await store.snapshot();
    const ticket = await this.cloud.prepareQuestionSet(input, state.revision, this.cloudBinding(state));
    await this.change((draft) => {
      draft.collection.status = "waiting_user";
      draft.collection.nextAction = "在 Codex 中核对摘要并明确确认冻结";
      draft.collection.updatedAt = new Date().toISOString();
      draft.activity.unshift({ id: randomUUID(), type: "confirmation", title: "问题集等待确认", detail: ticket.summary, status: "waiting", occurredAt: new Date().toISOString() });
    }, store);
    return { ticket, validation: { unique: true, count: input.questions.length, methodVersion: input.methodVersion } };
  }

  async commitQuestionSet(ticketId: string): Promise<unknown> {
    const store = this.requireStore();
    const receipt = await this.cloud.commitQuestionSet(ticketId);
    await this.change((draft) => {
      draft.collection = { ...draft.collection, status: "ready", questionSetId: receipt.questionSetId, receiptId: receipt.receiptId, provenance: "unavailable", nextAction: "运行官方平台采集预检", updatedAt: new Date().toISOString() };
      draft.activity.unshift({ id: randomUUID(), type: "system", title: "问题集已冻结", detail: `Receipt ${receipt.receiptId}`, status: "success", occurredAt: new Date().toISOString() });
    }, store);
    return receipt;
  }

  async prepareCollection(raw: unknown): Promise<unknown> {
    const store = this.requireStore();
    const input = collectionRequestSchema.parse(raw);
    const state = await store.snapshot();
    if (input.questionSetId !== state.collection.questionSetId) throw new Error("QUESTION_SET_NOT_CURRENT");
    if (input.maxCredit > state.task.budget) throw new Error("TASK_BUDGET_EXCEEDED");
    const result = await this.cloud.prepareCollection(input, state.revision, this.cloudBinding(state));
    await this.change((draft) => {
      draft.collection.status = "waiting_user";
      draft.collection.nextAction = "核对平台、Evidence 门和 Credit 后明确确认";
      draft.collection.updatedAt = new Date().toISOString();
      draft.task.estimatedCost = result.estimatedCredit;
      draft.activity.unshift({ id: randomUUID(), type: "confirmation", title: "官方采集等待确认", detail: result.ticket.summary, status: "waiting", occurredAt: new Date().toISOString() });
    }, store);
    return result;
  }

  async startCollection(ticketId: string, idempotencyKey: string): Promise<unknown> {
    const store = this.requireStore();
    const job = await this.cloud.startCollection(ticketId, idempotencyKey);
    await this.change((draft) => {
      draft.collection = { ...draft.collection, status: "queued", jobId: job.id, receiptId: job.receiptId, provenance: job.provenance, nextAction: "等待 Cloud 官方采集 Job", updatedAt: job.createdAt };
      draft.credit.reserved = job.reservedCredit;
      draft.activity.unshift({ id: randomUUID(), type: "collection", title: "官方采集已排队", detail: `${job.id} · ${job.provenance}`, status: "info", occurredAt: job.createdAt });
    }, store, "collection.changed");
    return job;
  }

  async getCollectionJob(jobId: string): Promise<unknown> {
    const store = this.requireStore();
    const job = await this.cloud.getCollectionJob(jobId);
    await this.change((draft) => {
      draft.collection.status = job.status;
      draft.collection.provenance = job.provenance;
      draft.collection.nextAction = job.status === "completed" ? "导出确定性数据集并在 Codex 中分析" : job.status === "failed" ? "查看失败原因并只重试失败项" : "稍后再次查询 Job";
      draft.collection.updatedAt = job.createdAt;
      draft.credit.reserved = Math.max(0, job.reservedCredit - job.settledCredit);
    }, store, "collection.changed");
    return job;
  }

  async analysisDataset(): Promise<unknown> {
    const state = await this.requireStore().snapshot();
    if (!state.collection.questionSetId) throw new Error("FROZEN_QUESTION_SET_REQUIRED");
    return this.cloud.getAnalysisDataset(state.collection.questionSetId);
  }

  accountStatus() { return this.auth.status(); }
  startAccountConnection() { return this.auth.start(); }
  pollAccountConnection() { return this.auth.poll(); }
  logoutAccount() { return this.auth.logout(); }

  async registerArtifact(raw: unknown): Promise<unknown> {
    const store = this.requireStore();
    const root = this.requireWorkspace().root;
    const input = artifactRegistrationSchema.parse(raw);
    const absolute = await resolveSafeProjectFile(root, input.relativePath);
    const digest = sha256(await readFile(absolute));
    if (digest !== input.expectedSha256) throw new Error("ARTIFACT_HASH_MISMATCH");
    const state = await store.snapshot({ refreshArtifacts: true });
    const artifact = state.artifacts.find((item) => item.relativePath === input.relativePath);
    if (!artifact) throw new Error("ARTIFACT_NOT_INDEXED");
    await store.addActivity({ type: "artifact", title: "本地产物已核验", detail: `${input.title} · ${artifact.sha256.slice(0, 12)}`, status: "success" });
    await this.emitState();
    return { artifact, authority: "local_workspace", message: "产物已在本地工作区核验；未上传 Cloud。" };
  }

  async readArtifact(relativePath: string): Promise<{ content: string; mediaType: string }> {
    const store = this.requireStore();
    const state = await store.snapshot();
    const artifact = state.artifacts.find((item) => item.relativePath === relativePath);
    if (!artifact) throw new Error("ARTIFACT_NOT_INDEXED");
    if (artifact.bytes > 2_000_000) throw new Error("PREVIEW_TOO_LARGE");
    const absolute = await resolveSafeProjectFile(this.requireWorkspace().root, artifact.relativePath);
    return { content: await readFile(absolute, "utf8"), mediaType: artifact.mediaType };
  }

  private async attachWorkspace(workspace: WorkspaceConnection): Promise<void> {
    const store = new ProjectStore(workspace.root);
    await store.snapshot({ refreshArtifacts: true });
    this.workspace = workspace;
    this.store = store;
  }

  private requireWorkspace(): WorkspaceConnection {
    if (!this.workspace) throw new Error("WORKSPACE_NOT_CONFIGURED");
    return this.workspace;
  }

  private requireStore(): ProjectStore {
    if (!this.store) throw new Error("WORKSPACE_NOT_CONFIGURED");
    return this.store;
  }

  private cloudBinding(state: ProjectState) {
    if (!state.organization || !state.project.cloudId) throw new Error("CLOUD_PROJECT_BINDING_REQUIRED");
    return { organizationId: state.organization.id, projectId: state.project.cloudId };
  }

  private assertUniqueQuestions(input: QuestionSet): void {
    const normalized = new Set<string>();
    for (const question of input.questions) {
      const key = question.text.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
      if (normalized.has(key)) throw new Error("DUPLICATE_QUESTION");
      normalized.add(key);
    }
  }

  private async change(mutator: (draft: ProjectState) => void, store: ProjectStore, type: DomainEvent["type"] = "state.changed") {
    const state = await store.update(mutator);
    this.events.emit("event", { id: randomUUID(), type, occurredAt: new Date().toISOString(), revision: state.revision } satisfies DomainEvent);
    return state;
  }

  private async emitState(): Promise<void> {
    const state = await this.state();
    this.events.emit("event", { id: randomUUID(), type: "state.changed", occurredAt: new Date().toISOString(), revision: state.revision } satisfies DomainEvent);
  }
}

export function validateCollectionRequest(input: CollectionRequest): CollectionRequest { return collectionRequestSchema.parse(input); }
export function validateArtifactRegistration(input: ArtifactRegistration): ArtifactRegistration { return artifactRegistrationSchema.parse(input); }
