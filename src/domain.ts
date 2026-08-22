import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import type { AuthSession } from "./auth-session.js";
import type { AccountOverview, CloudClient, ConnectionStatus } from "./cloud-client.js";
import { artifactRegistrationSchema, cloudProjectSelectionSchema, collectionRequestSchema, questionSetSchema } from "./contracts.js";
import type { ArtifactRegistration, CollectionRequest, ProjectState, QuestionSet } from "./contracts.js";
import type { RuntimeConfig } from "./config.js";
import { resolveSafeProjectFile, sha256 } from "./security.js";
import type { ProjectStore } from "./store.js";

export interface DomainEvent { id: string; type: "state.changed" | "collection.changed"; occurredAt: string; revision: number }

export class WorkbenchDomain {
  readonly events = new EventEmitter();

  constructor(readonly config: RuntimeConfig, readonly store: ProjectStore, readonly cloud: CloudClient, readonly auth: AuthSession) {}

  initialize(): Promise<ProjectState> { return this.store.snapshot({ refreshArtifacts: true }); }
  connectionStatus(): Promise<ConnectionStatus> { return this.cloud.connectionStatus(); }
  accountOverview(): Promise<AccountOverview> { return this.cloud.accountOverview(); }
  state(refreshArtifacts = false): Promise<ProjectState> { return this.store.snapshot({ refreshArtifacts }); }

  async bindCloudProject(raw: unknown): Promise<ProjectState> {
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
    });
  }

  async prepareQuestionSet(raw: unknown): Promise<unknown> {
    const input = questionSetSchema.parse(raw);
    this.assertUniqueQuestions(input);
    const state = await this.store.snapshot();
    const ticket = await this.cloud.prepareQuestionSet(input, state.revision, this.cloudBinding(state));
    await this.change((draft) => {
      draft.collection.status = "waiting_user";
      draft.collection.nextAction = "在 Codex 中核对摘要并明确确认冻结";
      draft.collection.updatedAt = new Date().toISOString();
      draft.activity.unshift({ id: randomUUID(), type: "confirmation", title: "问题集等待确认", detail: ticket.summary, status: "waiting", occurredAt: new Date().toISOString() });
    });
    return { ticket, validation: { unique: true, count: input.questions.length, methodVersion: input.methodVersion } };
  }

  async commitQuestionSet(ticketId: string): Promise<unknown> {
    const receipt = await this.cloud.commitQuestionSet(ticketId);
    await this.change((draft) => {
      draft.collection = { ...draft.collection, status: "ready", questionSetId: receipt.questionSetId, receiptId: receipt.receiptId, provenance: "unavailable", nextAction: "运行官方平台采集预检", updatedAt: new Date().toISOString() };
      draft.activity.unshift({ id: randomUUID(), type: "system", title: "问题集已冻结", detail: `Receipt ${receipt.receiptId}`, status: "success", occurredAt: new Date().toISOString() });
    });
    return receipt;
  }

  async prepareCollection(raw: unknown): Promise<unknown> {
    const input = collectionRequestSchema.parse(raw);
    const state = await this.store.snapshot();
    if (input.questionSetId !== state.collection.questionSetId) throw new Error("QUESTION_SET_NOT_CURRENT");
    if (input.maxCredit > state.task.budget) throw new Error("TASK_BUDGET_EXCEEDED");
    const result = await this.cloud.prepareCollection(input, state.revision, this.cloudBinding(state));
    await this.change((draft) => {
      draft.collection.status = "waiting_user";
      draft.collection.nextAction = "核对平台、Evidence 门和 Credit 后明确确认";
      draft.collection.updatedAt = new Date().toISOString();
      draft.task.estimatedCost = result.estimatedCredit;
      draft.activity.unshift({ id: randomUUID(), type: "confirmation", title: "官方采集等待确认", detail: result.ticket.summary, status: "waiting", occurredAt: new Date().toISOString() });
    });
    return result;
  }

  async startCollection(ticketId: string, idempotencyKey: string): Promise<unknown> {
    const job = await this.cloud.startCollection(ticketId, idempotencyKey);
    await this.change((draft) => {
      draft.collection = { ...draft.collection, status: "queued", jobId: job.id, receiptId: job.receiptId, provenance: job.provenance, nextAction: "等待 Cloud 官方采集 Job", updatedAt: job.createdAt };
      draft.credit.reserved = job.reservedCredit;
      draft.activity.unshift({ id: randomUUID(), type: "collection", title: "官方采集已排队", detail: `${job.id} · ${job.provenance}`, status: "info", occurredAt: job.createdAt });
    }, "collection.changed");
    return job;
  }

  async getCollectionJob(jobId: string): Promise<unknown> {
    const job = await this.cloud.getCollectionJob(jobId);
    await this.change((draft) => {
      draft.collection.status = job.status;
      draft.collection.provenance = job.provenance;
      draft.collection.nextAction = job.status === "completed" ? "导出确定性数据集并在 Codex 中分析" : job.status === "failed" ? "查看失败原因并只重试失败项" : "稍后再次查询 Job";
      draft.collection.updatedAt = new Date().toISOString();
      draft.credit.reserved = Math.max(0, job.reservedCredit - job.settledCredit);
    }, "collection.changed");
    return job;
  }

  async analysisDataset(): Promise<unknown> {
    const state = await this.store.snapshot();
    if (!state.collection.questionSetId) throw new Error("FROZEN_QUESTION_SET_REQUIRED");
    return this.cloud.getAnalysisDataset(state.collection.questionSetId);
  }

  accountStatus() { return this.auth.status(); }
  startAccountConnection() { return this.auth.start(); }
  pollAccountConnection() { return this.auth.poll(); }
  logoutAccount() { return this.auth.logout(); }

  async registerArtifact(raw: unknown): Promise<unknown> {
    const input = artifactRegistrationSchema.parse(raw);
    const absolute = await resolveSafeProjectFile(this.config.projectRoot, input.relativePath);
    const digest = sha256(await readFile(absolute));
    if (digest !== input.expectedSha256) throw new Error("ARTIFACT_HASH_MISMATCH");
    const state = await this.store.snapshot({ refreshArtifacts: true });
    const artifact = state.artifacts.find((item) => item.relativePath === input.relativePath);
    if (!artifact) throw new Error("ARTIFACT_NOT_INDEXED");
    await this.store.addActivity({ type: "artifact", title: "本地产物已核验", detail: `${input.title} · ${artifact.sha256.slice(0, 12)}`, status: "success" });
    await this.emitState();
    return { artifact, authority: "local_workspace", message: "产物已在本地工作区核验；未上传 Cloud。" };
  }

  async readArtifact(relativePath: string): Promise<{ content: string; mediaType: string }> {
    const state = await this.store.snapshot();
    const artifact = state.artifacts.find((item) => item.relativePath === relativePath);
    if (!artifact) throw new Error("ARTIFACT_NOT_INDEXED");
    if (artifact.bytes > 2_000_000) throw new Error("PREVIEW_TOO_LARGE");
    const absolute = await resolveSafeProjectFile(this.config.projectRoot, artifact.relativePath);
    return { content: await readFile(absolute, "utf8"), mediaType: artifact.mediaType };
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

  private async change(mutator: (draft: ProjectState) => void, type: DomainEvent["type"] = "state.changed") {
    const state = await this.store.update(mutator);
    this.events.emit("event", { id: randomUUID(), type, occurredAt: new Date().toISOString(), revision: state.revision } satisfies DomainEvent);
    return state;
  }

  private async emitState(): Promise<void> {
    const state = await this.store.snapshot();
    this.events.emit("event", { id: randomUUID(), type: "state.changed", occurredAt: new Date().toISOString(), revision: state.revision } satisfies DomainEvent);
  }
}

export function validateCollectionRequest(input: CollectionRequest): CollectionRequest { return collectionRequestSchema.parse(input); }
export function validateArtifactRegistration(input: ArtifactRegistration): ArtifactRegistration { return artifactRegistrationSchema.parse(input); }
