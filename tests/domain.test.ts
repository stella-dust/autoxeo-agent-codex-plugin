import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthSession } from "../src/auth-session.js";
import type { AccountOverview, CaptureJob, CapturePreflight, CloudClient, ConnectionStatus } from "../src/cloud-client.js";
import type { RuntimeConfig } from "../src/config.js";
import type { CaptureRequest, ConfirmationTicket } from "../src/contracts.js";
import { WorkbenchDomain } from "../src/domain.js";
import { ProjectStore } from "../src/store.js";

class ProductionCloudStub implements CloudClient {
  connectionStatus(): Promise<ConnectionStatus> { throw new Error("unused"); }
  accountOverview(): Promise<AccountOverview> {
    return Promise.resolve({
      protocolVersion: "2026-08-09.plugin.v1",
      account: { id: "user-1", email: "owner@example.com", name: "Owner", emailVerified: new Date().toISOString(), status: "active" },
      organizations: [{
        id: "org-1",
        name: "AutoXEO",
        slug: "autoxeo",
        role: "owner",
        entitlement: { planCode: "internal", planName: "Internal", subscriptionStatus: "active", currentPeriodEnd: null, trialEndsAt: null },
        credit: { available: 500, includedPerMonth: 0, usedThisPeriod: 0, usageEventCount: 0, periodStart: new Date().toISOString() },
        quota: { projects: { current: 1, limit: 1 }, members: { current: 1, limit: 2 }, collectionRuns: { limit: 100 } },
        projects: [{ id: "project-1", name: "Agent", brand: { id: "brand-1", name: "AutoXEO" } }],
        invoices: [],
      }],
      links: { account: "https://agent.autoxeo.com/account", support: "https://agent.autoxeo.com/support/" },
      refreshedAt: new Date().toISOString(),
    });
  }
  prepareQuestionSet(): Promise<ConfirmationTicket> { throw new Error("unused"); }
  commitQuestionSet(): Promise<{ questionSetId: string; receiptId: string }> { throw new Error("unused"); }
  prepareCapture(input: CaptureRequest, expectedRevision: number): Promise<CapturePreflight> {
    return Promise.resolve({
      ticket: { id: "confirm-production", operation: "start_capture", summary: "DeepSeek 正式采集", estimatedCredit: 8, maxCredit: input.maxCredit, expiresAt: new Date(Date.now() + 60_000).toISOString(), inputDigest: "a".repeat(64), expectedRevision },
      platforms: [{ platform: "deepseek", available: true, searchEnabled: true }],
      estimatedCredit: 8,
      evidenceStatus: "authoritative",
    });
  }
  startCapture(): Promise<CaptureJob> {
    return Promise.resolve({ id: "job-production", status: "queued", receiptId: "receipt-production", provenance: "official_api", reservedCredit: 8, settledCredit: 0, createdAt: new Date().toISOString() });
  }
  getJob(): Promise<CaptureJob> { throw new Error("unused"); }
}

describe("WorkbenchDomain", () => {
  let projectRoot: string;
  let domain: WorkbenchDomain;

  beforeEach(async () => {
    projectRoot = path.join(await mkdtemp(path.join(tmpdir(), "autoxeo-domain-")), "AutoXEO_Workspace");
    const config: RuntimeConfig = { projectRoot, pluginDataRoot: path.join(projectRoot, ".autoxeo/runtime"), mode: "cloud", logLevel: "error" };
    const auth = new AuthSession(config);
    domain = new WorkbenchDomain(config, new ProjectStore(projectRoot), new ProductionCloudStub(), auth);
    await domain.initialize();
    await domain.store.update((state) => {
      state.organization = { id: "org-1", name: "AutoXEO" };
      state.project.id = "project-1";
      state.project.name = "Agent";
      state.task.budget = 100;
    });
  });

  afterEach(async () => { await rm(path.dirname(projectRoot), { recursive: true, force: true }); });

  it("rejects duplicate questions before a Cloud confirmation", async () => {
    await expect(domain.prepareQuestionSet({ title: "测试问题", questions: [
      { id: "q1", text: "AutoXEO 如何做 GEO？", intent: "awareness", persona: "市场负责人" },
      { id: "q2", text: " AutoXEO如何做GEO？ ", intent: "consideration", persona: "市场负责人" },
    ] })).rejects.toThrow("DUPLICATE_QUESTION");
  });

  it("preserves official_api provenance for production capture", async () => {
    const prepared = await domain.prepareCapture({ questionSetId: "questions-v1", platforms: ["deepseek"], maxCredit: 50 }) as CapturePreflight;
    expect(prepared.evidenceStatus).toBe("authoritative");
    const job = await domain.startCapture(prepared.ticket.id, "capture-idempotency-1") as CaptureJob;
    expect(job.provenance).toBe("official_api");
    expect((await domain.state()).activity[0]?.detail).toContain("official_api");
  });

  it("binds a reviewed Cloud project and explicit task budget", async () => {
    const bound = await domain.bindCloudProject({
      organizationId: "org-1",
      projectId: "project-1",
      taskBudget: 80,
    });
    expect(bound.organization).toEqual({ id: "org-1", name: "AutoXEO" });
    expect(bound.project).toMatchObject({ id: "project-1", name: "Agent" });
    expect(bound.credit).toMatchObject({ available: 500, authoritative: true });
    expect(bound.task).toMatchObject({ id: "task-unbound", budget: 80 });
  });

  it("rejects a capture limit above the task budget", async () => {
    await expect(domain.prepareCapture({ questionSetId: "questions-v1", platforms: ["deepseek"], maxCredit: 101 })).rejects.toThrow("TASK_BUDGET_EXCEEDED");
  });
});
