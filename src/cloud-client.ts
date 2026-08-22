import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthSession, AccountStatus } from "./auth-session.js";
import type { RuntimeConfig } from "./config.js";
import type { CollectionRequest, ConfirmationTicket, Platform, ProjectState, QuestionSet } from "./contracts.js";
import { PROTOCOL_VERSION, apiErrorSchema } from "./contracts.js";

export interface PlatformCapacity {
  platform: Platform;
  label: string;
  state: "ready" | "configuration_required" | "eligibility_required" | "unavailable";
  search: string;
  detail: string;
}

export interface ConnectionStatus {
  connected: boolean;
  mode: "cloud";
  protocolVersion: typeof PROTOCOL_VERSION;
  evidenceStatus: "authoritative" | "unavailable";
  captureChannel: "official_api" | "unavailable";
  message: string;
  account: AccountStatus;
  runtime: { localDaemon: "online"; cloudGateway: "online" | "offline" | "configuration_required"; queue: "available" | "unavailable" };
  concurrency: { interactive: { active: number; limit: number | null }; batch: { active: number; limit: number | null }; source: "cloud" | "unavailable" };
  platforms: PlatformCapacity[];
}

export interface AccountOverview {
  protocolVersion: typeof PROTOCOL_VERSION;
  account: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: string | null;
    status: string;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: "owner" | "admin" | "analyst" | "viewer";
    entitlement: {
      planCode: string;
      planName: string;
      subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | "expired" | "inactive";
      currentPeriodEnd: string | null;
      trialEndsAt: string | null;
    };
    credit: {
      available: number;
      includedPerMonth: number;
      usedThisPeriod: number;
      usageEventCount: number;
      periodStart: string;
    };
    quota: {
      projects: { current: number; limit: number };
      members: { current: number; limit: number };
      collectionRuns: { limit: number };
    };
    projects: Array<{
      id: string;
      name: string;
      brand: { id: string; name: string };
    }>;
    invoices: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      provider: "stripe" | "wechat" | "alipay" | "manual";
      pdfUrl: string | null;
      createdAt: string;
    }>;
  }>;
  links: { account: string; support: string };
  refreshedAt: string;
}

export interface CloudProjectBinding {
  organizationId: string;
  projectId: string;
}

export interface CollectionPreflight {
  ticket: ConfirmationTicket;
  platforms: Array<{ platform: Platform; available: boolean; searchEnabled: boolean }>;
  estimatedCredit: number;
  evidenceStatus: "authoritative";
}

export interface CollectionJob {
  id: string;
  status: "queued" | "running" | "partial_failed" | "failed" | "cancelled" | "completed";
  receiptId: string;
  provenance: "official_api";
  reservedCredit: number;
  settledCredit: number;
  createdAt: string;
}

export interface CloudClient {
  connectionStatus(): Promise<ConnectionStatus>;
  accountOverview(): Promise<AccountOverview>;
  prepareQuestionSet(input: QuestionSet, expectedRevision: number, binding: CloudProjectBinding): Promise<ConfirmationTicket>;
  commitQuestionSet(ticketId: string): Promise<{ questionSetId: string; receiptId: string }>;
  prepareCollection(input: CollectionRequest, expectedRevision: number, binding: CloudProjectBinding): Promise<CollectionPreflight>;
  startCollection(ticketId: string, idempotencyKey: string): Promise<CollectionJob>;
  getCollectionJob(jobId: string): Promise<CollectionJob>;
  getAnalysisDataset(questionSetId: string): Promise<unknown>;
}

const pluginConnectionSchema = z.object({
  protocolVersion: z.string(),
  queue: z.enum(["available", "unavailable"]),
  concurrency: z.object({
    interactive: z.object({ active: z.number().int().nonnegative(), limit: z.number().int().positive() }),
    batch: z.object({ active: z.number().int().nonnegative(), limit: z.number().int().positive() }),
  }),
  platforms: z.array(z.object({
    platform: z.enum(["doubao", "qwen", "deepseek", "yuanbao", "kimi"]),
    state: z.enum(["ready", "configuration_required", "eligibility_required", "unavailable"]),
    search: z.string(),
    detail: z.string(),
  })),
});

const accountOverviewSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  account: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().nullable(),
    emailVerified: z.string().datetime().nullable(),
    status: z.string().min(1),
  }),
  organizations: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    role: z.enum(["owner", "admin", "analyst", "viewer"]),
    entitlement: z.object({
      planCode: z.string().min(1),
      planName: z.string().min(1),
      subscriptionStatus: z.enum(["trialing", "active", "past_due", "canceled", "expired", "inactive"]),
      currentPeriodEnd: z.string().datetime().nullable(),
      trialEndsAt: z.string().datetime().nullable(),
    }),
    credit: z.object({
      available: z.number().int(),
      includedPerMonth: z.number().int().nonnegative(),
      usedThisPeriod: z.number().int().nonnegative(),
      usageEventCount: z.number().int().nonnegative(),
      periodStart: z.string().datetime(),
    }),
    quota: z.object({
      projects: z.object({ current: z.number().int().nonnegative(), limit: z.number().int() }),
      members: z.object({ current: z.number().int().nonnegative(), limit: z.number().int() }),
      collectionRuns: z.object({ limit: z.number().int() }),
    }),
    projects: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      brand: z.object({ id: z.string().min(1), name: z.string().min(1) }),
    })),
    invoices: z.array(z.object({
      id: z.string().min(1),
      amount: z.number().int(),
      currency: z.string().min(3).max(3),
      status: z.string().min(1),
      provider: z.enum(["stripe", "wechat", "alipay", "manual"]),
      pdfUrl: z.string().url().nullable(),
      createdAt: z.string().datetime(),
    })),
  })),
  links: z.object({ account: z.string().url(), support: z.string().url() }),
  refreshedAt: z.string().datetime(),
});

const labels: Record<Platform, string> = { doubao: "豆包", qwen: "千问", deepseek: "DeepSeek", yuanbao: "腾讯元宝", kimi: "Kimi" };
const unavailablePlatforms = (): PlatformCapacity[] => (Object.keys(labels) as Platform[]).map((platform) => ({
  platform,
  label: labels[platform],
  state: "configuration_required",
  search: "等待 Cloud 能力回执",
  detail: platform === "deepseek" ? "DeepSeek 适配器已实现；生产环境密钥与联网搜索需通过 Cloud 预检。" : "首版保留平台位；等待官方 API 凭据与生产资格。",
}));

export class HttpCloudClient implements CloudClient {
  constructor(private readonly config: RuntimeConfig, private readonly auth: AuthSession) {}

  async connectionStatus(): Promise<ConnectionStatus> {
    const account = this.auth.status();
    const base: ConnectionStatus = {
      connected: false,
      mode: "cloud",
      protocolVersion: PROTOCOL_VERSION,
      evidenceStatus: "unavailable",
      captureChannel: "unavailable",
      message: account.message,
      account,
      runtime: { localDaemon: "online", cloudGateway: this.config.cloudBaseUrl ? "offline" : "configuration_required", queue: "unavailable" },
      concurrency: { interactive: { active: 0, limit: null }, batch: { active: 0, limit: null }, source: "unavailable" },
      platforms: unavailablePlatforms(),
    };
    if (!this.config.cloudBaseUrl || account.state !== "signed_in") return base;
    const token = await this.auth.accessToken();
    if (!token) return base;
    try {
      const response = await fetch(new URL("/api/plugin/v1/connection", this.config.cloudBaseUrl), {
        method: "GET",
        signal: AbortSignal.timeout(15_000),
        headers: { authorization: `Bearer ${token}`, "x-autoxeo-protocol": PROTOCOL_VERSION },
      });
      if (!response.ok) return { ...base, message: `Cloud Plugin API 尚未就绪（HTTP ${response.status}）；本地 Workspace 可继续使用。` };
      const remote = pluginConnectionSchema.parse(await response.json());
      return {
        ...base,
        connected: true,
        evidenceStatus: "authoritative",
        captureChannel: "official_api",
        message: "AutoXEO Cloud 已连接；平台能力与并发来自 Cloud 权威回执。",
        runtime: { localDaemon: "online", cloudGateway: "online", queue: remote.queue },
        concurrency: { ...remote.concurrency, source: "cloud" },
        platforms: remote.platforms.map((item) => ({ ...item, label: labels[item.platform] })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "CLOUD_UNAVAILABLE";
      return { ...base, message: `Cloud 连接失败：${message}。未创建 Job，也不会扣除 Credit。` };
    }
  }

  async accountOverview(): Promise<AccountOverview> {
    const result = await this.request<unknown>("/api/plugin/v1/account", { method: "GET" });
    return accountOverviewSchema.parse(result);
  }

  prepareQuestionSet(input: QuestionSet, expectedRevision: number, binding: CloudProjectBinding): Promise<ConfirmationTicket> {
    return this.request("/api/plugin/v1/question-sets/prepare", { method: "POST", body: JSON.stringify({ input, expectedRevision, binding }) });
  }
  commitQuestionSet(ticketId: string): Promise<{ questionSetId: string; receiptId: string }> {
    return this.request("/api/plugin/v1/question-sets/commit", { method: "POST", body: JSON.stringify({ ticketId, idempotencyKey: randomUUID() }) });
  }
  prepareCollection(input: CollectionRequest, expectedRevision: number, binding: CloudProjectBinding): Promise<CollectionPreflight> {
    return this.request("/api/plugin/v1/captures/prepare", { method: "POST", body: JSON.stringify({ input, expectedRevision, binding }) });
  }
  startCollection(ticketId: string, idempotencyKey: string): Promise<CollectionJob> {
    return this.request("/api/plugin/v1/captures", { method: "POST", body: JSON.stringify({ ticketId, idempotencyKey }) });
  }
  getCollectionJob(jobId: string): Promise<CollectionJob> {
    return this.request(`/api/plugin/v1/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });
  }

  getAnalysisDataset(questionSetId: string): Promise<unknown> {
    return this.request(`/api/plugin/v1/analysis-dataset?questionSetId=${encodeURIComponent(questionSetId)}`, { method: "GET" });
  }

  private async request<T>(pathname: string, init: RequestInit): Promise<T> {
    if (!this.config.cloudBaseUrl) throw new Error("CLOUD_ORIGIN_NOT_CONFIGURED");
    const token = await this.auth.accessToken();
    if (!token) throw new Error("AUTOXEO_ACCOUNT_SIGN_IN_REQUIRED");
    const requestId = randomUUID();
    const response = await fetch(new URL(pathname, this.config.cloudBaseUrl), {
      ...init,
      signal: AbortSignal.timeout(30_000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-autoxeo-protocol": PROTOCOL_VERSION, "x-request-id": requestId, ...init.headers },
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(body);
      if (parsed.success) throw new Error(`${parsed.data.code}: ${parsed.data.message}`);
      throw new Error(`CLOUD_HTTP_${response.status}`);
    }
    return body as T;
  }
}

export function mergeAuthoritativeConnection(state: ProjectState, status: ConnectionStatus): ProjectState {
  return status.connected ? { ...state, credit: { ...state.credit, authoritative: true } } : state;
}
