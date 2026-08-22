import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthSession } from "../src/auth-session.js";
import type { AccountOverview, CloudClient, CollectionJob, CollectionPreflight, ConnectionStatus } from "../src/cloud-client.js";
import type { RuntimeConfig } from "../src/config.js";
import type { CollectionRequest, ConfirmationTicket } from "../src/contracts.js";
import { WorkbenchDomain } from "../src/domain.js";
import { ProjectStore } from "../src/store.js";

class CloudStub implements CloudClient {
  connectionStatus(): Promise<ConnectionStatus> { throw new Error("unused"); }
  accountOverview(): Promise<AccountOverview> { return Promise.resolve({
    protocolVersion: "2026-08-22.plugin.v2", account: { id: "user-1", email: "owner@example.com", name: "Owner", emailVerified: new Date().toISOString(), status: "active" },
    organizations: [{ id: "org-1", name: "AutoXEO", slug: "autoxeo", role: "owner", entitlement: { planCode: "internal", planName: "Internal", subscriptionStatus: "active", currentPeriodEnd: null, trialEndsAt: null }, credit: { available: 500, includedPerMonth: 0, usedThisPeriod: 0, usageEventCount: 0, periodStart: new Date().toISOString() }, quota: { projects: { current: 1, limit: 1 }, members: { current: 1, limit: 2 }, collectionRuns: { limit: 100 } }, projects: [{ id: "project-1", name: "Agent", brand: { id: "brand-1", name: "AutoXEO" } }], invoices: [] }],
    links: { account: "https://agent.autoxeo.com/account", support: "https://agent.autoxeo.com/support/" }, refreshedAt: new Date().toISOString(),
  }); }
  prepareQuestionSet(): Promise<ConfirmationTicket> { return Promise.resolve({ id: "freeze-1", operation: "freeze_question_set", summary: "冻结", estimatedCredit: 0, maxCredit: 0, expiresAt: new Date(Date.now() + 60_000).toISOString(), inputDigest: "a".repeat(64), expectedRevision: 1 }); }
  commitQuestionSet(): Promise<{ questionSetId: string; receiptId: string }> { return Promise.resolve({ questionSetId: "questions-v1", receiptId: "freeze-receipt" }); }
  prepareCollection(input: CollectionRequest, expectedRevision: number): Promise<CollectionPreflight> { return Promise.resolve({ ticket: { id: "collect-1", operation: "start_capture", summary: "DeepSeek 官方采集", estimatedCredit: 8, maxCredit: input.maxCredit, expiresAt: new Date(Date.now() + 60_000).toISOString(), inputDigest: "b".repeat(64), expectedRevision }, platforms: [{ platform: "deepseek", available: true, searchEnabled: true }], estimatedCredit: 8, evidenceStatus: "authoritative" }); }
  startCollection(): Promise<CollectionJob> { return Promise.resolve({ id: "job-1", status: "queued", receiptId: "receipt-1", provenance: "official_api", reservedCredit: 8, settledCredit: 0, createdAt: new Date().toISOString() }); }
  getCollectionJob(): Promise<CollectionJob> { throw new Error("unused"); }
  getAnalysisDataset(): Promise<unknown> { return Promise.resolve({ provenance: "official_api", observations: [] }); }
}

describe("WorkbenchDomain", () => {
  let container: string; let domain: WorkbenchDomain;
  beforeEach(async () => {
    container = await mkdtemp(path.join(tmpdir(), "autoxeo-domain-"));
    const projectRoot = path.join(container, "AutoXEO_Workspace");
    const config: RuntimeConfig = { projectRoot, pluginDataRoot: path.join(projectRoot, ".runtime"), cloudBaseUrl: "https://agent.autoxeo.com", mode: "cloud", logLevel: "error" };
    domain = new WorkbenchDomain(config, new ProjectStore(projectRoot), new CloudStub(), new AuthSession(config));
    await domain.initialize();
    await domain.bindCloudProject({ organizationId: "org-1", projectId: "project-1", taskBudget: 100 });
  });
  afterEach(async () => rm(container, { recursive: true, force: true }));

  it("rejects duplicate Codex-generated questions before Cloud", async () => {
    const base = { intent: "awareness", persona: "市场负责人", questionType: "open", brandMention: "excluded", evidenceTier: "A" };
    await expect(domain.prepareQuestionSet({ title: "测试", methodVersion: "geo-question-method-2026-08", questions: [{ id: "q1", text: "AutoXEO 如何做 GEO？", ...base }, { id: "q2", text: " AutoXEO如何做GEO？ ", ...base }] })).rejects.toThrow("DUPLICATE_QUESTION");
  });

  it("keeps official collection separate from Codex reasoning", async () => {
    await domain.store.update((draft) => { draft.collection.questionSetId = "questions-v1"; draft.collection.status = "ready"; });
    const prepared = await domain.prepareCollection({ questionSetId: "questions-v1", platforms: ["deepseek"], maxCredit: 50 }) as CollectionPreflight;
    expect(prepared.evidenceStatus).toBe("authoritative");
    const job = await domain.startCollection(prepared.ticket.id, "collection-idempotency-1") as CollectionJob;
    expect(job.provenance).toBe("official_api");
    expect((await domain.state()).collection.jobId).toBe("job-1");
  });
});
