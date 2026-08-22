import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { RuntimeConfig } from "./config.js";
import {
  artifactRegistrationSchema,
  captureRequestSchema,
  cloudProjectSelectionSchema,
  questionSetSchema,
} from "./contracts.js";
import type { ArtifactRegistration, CaptureRequest, ProjectState, QuestionSet } from "./contracts.js";
import type { AccountOverview, CloudClient, ConnectionStatus } from "./cloud-client.js";
import type { ProjectStore } from "./store.js";
import { resolveSafeProjectFile, sha256 } from "./security.js";
import { readFile } from "node:fs/promises";
import type { AuthSession } from "./auth-session.js";

export interface DomainEvent {
  id: string;
  type: "state.changed" | "job.changed";
  occurredAt: string;
  revision: number;
}

export class WorkbenchDomain {
  readonly events = new EventEmitter();

  constructor(
    readonly config: RuntimeConfig,
    readonly store: ProjectStore,
    readonly cloud: CloudClient,
    readonly auth: AuthSession,
  ) {}

  async initialize(): Promise<ProjectState> {
    return this.store.snapshot({ refreshArtifacts: true });
  }

  async connectionStatus(): Promise<ConnectionStatus> {
    return this.cloud.connectionStatus();
  }

  async accountOverview(): Promise<AccountOverview> {
    return this.cloud.accountOverview();
  }

  async bindCloudProject(raw: unknown): Promise<ProjectState> {
    const input = cloudProjectSelectionSchema.parse(raw);
    const overview = await this.cloud.accountOverview();
    const organization = overview.organizations.find(
      (item) => item.id === input.organizationId,
    );
    const project = organization?.projects.find(
      (item) => item.id === input.projectId,
    );
    if (!organization || !project) throw new Error("CLOUD_PROJECT_NOT_FOUND");
    if (input.taskBudget > organization.credit.available) {
      throw new Error(
        `TASK_BUDGET_EXCEEDS_AVAILABLE_CREDIT: ${organization.credit.available}`,
      );
    }
    return this.change((draft) => {
      draft.organization = { id: organization.id, name: organization.name };
      draft.project = {
        ...draft.project,
        id: project.id,
        name: project.name,
      };
      draft.brand = {
        id: project.brand.id,
        name: project.brand.name,
        publicationId: null,
        publicationStatus: "missing",
        completeness: 0,
      };
      draft.credit = {
        available: organization.credit.available,
        reserved: 0,
        currency: "CREDIT",
        authoritative: true,
      };
      draft.task = {
        ...draft.task,
        id: "task-unbound",
        budget: input.taskBudget,
        status: "ready",
        nextAction: "建立或冻结问题集",
      };
      for (const node of draft.nodes) {
        if (node.kind === "question_research") {
          node.status = "ready";
          node.summary = "Cloud 项目已绑定，可在 Codex 中建立并冻结问题集。";
          node.nextAction = "建立首个问题集";
        } else if (node.kind === "platform_capture") {
          node.status = "blocked";
          node.summary = "等待当前 Cloud 项目的冻结问题版本。";
          node.nextAction = "先冻结问题集";
        } else {
          node.status = "not_selected";
          node.nextAction = null;
        }
      }
      draft.activity.unshift({
        id: randomUUID(),
        type: "system",
        title: "Cloud 项目已绑定",
        detail: `${organization.name} · ${project.name} · 任务预算 ${input.taskBudget} Credit`,
        status: "success",
        occurredAt: new Date().toISOString(),
      });
    });
  }

  async state(refreshArtifacts = false): Promise<ProjectState> {
    return this.store.snapshot({ refreshArtifacts });
  }

  async prepareQuestionSet(raw: unknown): Promise<unknown> {
    const input = questionSetSchema.parse(raw);
    this.assertUniqueQuestions(input);
    const state = await this.store.snapshot();
    const binding = this.cloudBinding(state);
    const ticket = await this.cloud.prepareQuestionSet(
      input,
      state.revision,
      binding,
    );
    await this.change((draft) => {
      const node = draft.nodes.find((item) => item.kind === "question_research");
      if (node) {
        node.status = "waiting_user";
        node.nextAction = "确认冻结问题集";
        node.summary = `${input.questions.length} 个问题已校验，确认后冻结。`;
      }
      draft.task.status = "waiting_user";
      draft.task.nextAction = "确认冻结问题集";
      draft.activity.unshift({
        id: randomUUID(),
        type: "confirmation",
        title: "问题集等待确认",
        detail: ticket.summary,
        status: "waiting",
        occurredAt: new Date().toISOString(),
      });
    });
    return { ticket, validation: { unique: true, count: input.questions.length } };
  }

  async commitQuestionSet(ticketId: string): Promise<unknown> {
    const receipt = await this.cloud.commitQuestionSet(ticketId);
    await this.change((draft) => {
      const node = draft.nodes.find((item) => item.kind === "question_research");
      if (node) {
        node.status = "completed";
        node.nextAction = null;
        node.summary = "问题版本已冻结并生成 Cloud Receipt。";
      }
      const capture = draft.nodes.find((item) => item.kind === "platform_capture");
      if (capture) capture.status = "ready";
      draft.task.status = "ready";
      draft.task.id = receipt.questionSetId;
      draft.task.nextAction = "运行平台采集预检";
      draft.activity.unshift({
        id: randomUUID(),
        type: "system",
        title: "问题集已冻结",
        detail: `Receipt ${receipt.receiptId}`,
        status: "success",
        occurredAt: new Date().toISOString(),
      });
    });
    return receipt;
  }

  async prepareCapture(raw: unknown): Promise<unknown> {
    const input = captureRequestSchema.parse(raw);
    const state = await this.store.snapshot();
    const binding = this.cloudBinding(state);
    if (input.maxCredit > state.task.budget) throw new Error("TASK_BUDGET_EXCEEDED");
    const result = await this.cloud.prepareCapture(
      input,
      state.revision,
      binding,
    );
    await this.change((draft) => {
      const node = draft.nodes.find((item) => item.kind === "platform_capture");
      if (node) {
        node.status = "waiting_user";
        node.nextAction = "确认本批采集预算";
        node.summary = `${input.platforms.length} 个平台预检完成，估算 ${result.estimatedCredit.toFixed(1)} Credit。`;
      }
      draft.task.status = "waiting_user";
      draft.task.nextAction = "确认本批采集预算";
      draft.task.estimatedCost = result.estimatedCredit;
      draft.activity.unshift({
        id: randomUUID(),
        type: "confirmation",
        title: "采集等待确认",
        detail: result.ticket.summary,
        status: "waiting",
        occurredAt: new Date().toISOString(),
      });
    });
    return result;
  }

  async startCapture(ticketId: string, idempotencyKey: string): Promise<unknown> {
    const job = await this.cloud.startCapture(ticketId, idempotencyKey);
    await this.change((draft) => {
      const node = draft.nodes.find((item) => item.kind === "platform_capture");
      if (node) {
        node.status = "running";
        node.nextAction = "等待 Cloud Job";
        node.summary = `Job ${job.id} 已创建；provenance=${job.provenance}。`;
      }
      draft.credit.reserved = job.reservedCredit;
      draft.task.status = "running";
      draft.task.nextAction = "查看采集进度";
      draft.activity.unshift({
        id: randomUUID(),
        type: "job",
        title: "平台采集已排队",
        detail: `${job.id} · ${job.provenance}`,
        status: "info",
        occurredAt: job.createdAt,
      });
    }, "job.changed");
    return job;
  }

  async getJob(jobId: string): Promise<unknown> {
    return this.cloud.getJob(jobId);
  }

  async analysisDataset(): Promise<unknown> {
    const state = await this.store.snapshot();
    return {
      protocolVersion: state.protocolVersion,
      mode: state.mode,
      taskId: state.task.id,
      brand: { id: state.brand.id, name: state.brand.name, publicationId: state.brand.publicationId },
      datasetStatus: "cloud_contract_required",
      observations: [],
      metrics: null,
      provenance: "unavailable",
      methodVersion: "geo-metrics-2026-08",
      warning: "只有 Cloud 返回的 official_api observed 数据才能生成权威指标。",
    };
  }

  accountStatus() { return this.auth.status(); }
  startAccountConnection() { return this.auth.start(); }
  pollAccountConnection() { return this.auth.poll(); }
  logoutAccount() { return this.auth.logout(); }

  private cloudBinding(state: ProjectState) {
    if (
      state.organization.id === "unbound" ||
      state.project.id === "workspace-local"
    ) {
      throw new Error("CLOUD_PROJECT_BINDING_REQUIRED");
    }
    return {
      organizationId: state.organization.id,
      projectId: state.project.id,
    };
  }

  async registerArtifact(raw: unknown): Promise<unknown> {
    const input = artifactRegistrationSchema.parse(raw);
    const absolute = await resolveSafeProjectFile(this.config.projectRoot, input.relativePath);
    const digest = sha256(await readFile(absolute));
    if (digest !== input.expectedSha256) throw new Error("ARTIFACT_HASH_MISMATCH");
    const state = await this.store.snapshot({ refreshArtifacts: true });
    const artifact = state.artifacts.find((item) => item.relativePath === input.relativePath);
    if (!artifact) throw new Error("ARTIFACT_NOT_INDEXED");
    await this.store.addActivity({
      type: "artifact",
      title: "本地产物已核验",
      detail: `${input.title} · ${artifact.sha256.slice(0, 12)}`,
      status: "success",
    });
    await this.emitState();
    return { artifact, registeredInCloud: false, message: "v0.1 本地内测只核验本地产物；Cloud 登记需生产契约。" };
  }

  async readArtifact(relativePath: string): Promise<{ content: string; mediaType: string }> {
    const state = await this.store.snapshot();
    const artifact = state.artifacts.find((item) => item.relativePath === relativePath);
    if (!artifact) throw new Error("ARTIFACT_NOT_INDEXED");
    if (artifact.bytes > 2_000_000) throw new Error("PREVIEW_TOO_LARGE");
    const absolute = await resolveSafeProjectFile(this.config.projectRoot, artifact.relativePath);
    return { content: await readFile(absolute, "utf8"), mediaType: artifact.mediaType };
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
    this.events.emit("event", {
      id: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      revision: state.revision,
    } satisfies DomainEvent);
    return state;
  }

  private async emitState(): Promise<void> {
    const state = await this.store.snapshot();
    this.events.emit("event", {
      id: randomUUID(),
      type: "state.changed",
      occurredAt: new Date().toISOString(),
      revision: state.revision,
    } satisfies DomainEvent);
  }
}

export function validateCaptureRequest(input: CaptureRequest): CaptureRequest {
  return captureRequestSchema.parse(input);
}

export function validateArtifactRegistration(input: ArtifactRegistration): ArtifactRegistration {
  return artifactRegistrationSchema.parse(input);
}
