// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectState } from "../../src/contracts.js";
import { App } from "./App.js";

const timestamp = "2026-08-11T02:30:00.000Z";
const state: ProjectState = {
  schemaVersion: 1,
  protocolVersion: "2026-08-09.plugin.v1",
  revision: 3,
  mode: "cloud",
  project: {
    id: "project-1",
    name: "中国 GEO 运营",
    rootName: "AutoXEO_Workspace",
  },
  organization: { id: "org-1", name: "AutoXEO" },
  brand: {
    id: "brand-1",
    name: "AutoXEO",
    publicationId: "publication-1",
    publicationStatus: "published",
    completeness: 82,
  },
  credit: {
    available: 500,
    reserved: 0,
    currency: "CREDIT",
    authoritative: true,
  },
  task: {
    id: "question-version-1",
    title: "DeepSeek 基线",
    status: "ready",
    nextAction: "采集预检",
    budget: 80,
    estimatedCost: 5,
  },
  nodes: [],
  knowledge: [],
  artifacts: [],
  activity: [],
  updatedAt: timestamp,
};

const connection = {
  connected: true,
  mode: "cloud",
  evidenceStatus: "authoritative",
  message: "Cloud 已连接",
  account: {
    state: "signed_in",
    message: "已连接 owner@example.cn",
    deviceId: "device-1",
    accessExpiresAt: timestamp,
    refreshExpiresAt: timestamp,
  },
  runtime: {
    localDaemon: "online",
    cloudGateway: "online",
    queue: "available",
  },
  concurrency: {
    interactive: { active: 0, limit: 5 },
    batch: { active: 0, limit: 2 },
    source: "cloud",
  },
  platforms: [
    {
      platform: "deepseek",
      label: "DeepSeek",
      state: "ready",
      search: "not_available",
      detail: "官方 API 可用；不声称联网搜索",
    },
  ],
} as const;

const account = {
  account: {
    id: "user-1",
    email: "owner@example.cn",
    name: "Owner",
    emailVerified: timestamp,
    status: "active",
  },
  organizations: [
    {
      id: "org-1",
      name: "AutoXEO",
      slug: "autoxeo",
      role: "owner",
      entitlement: {
        planCode: "closed_beta",
        planName: "内测",
        subscriptionStatus: "active",
        currentPeriodEnd: null,
        trialEndsAt: null,
      },
      credit: {
        available: 500,
        includedPerMonth: 500,
        usedThisPeriod: 5,
        usageEventCount: 1,
        periodStart: timestamp,
      },
      quota: {
        projects: { current: 1, limit: 3 },
        members: { current: 1, limit: 3 },
        collectionRuns: { limit: 100 },
      },
      projects: [
        {
          id: "project-1",
          name: "中国 GEO 运营",
          brand: { id: "brand-1", name: "AutoXEO" },
        },
      ],
      invoices: [],
    },
  ],
  links: {
    account: "https://agent.autoxeo.com/dashboard/settings",
    support: "https://agent.autoxeo.com/support/",
  },
  refreshedAt: timestamp,
};

class EventSourceStub {
  addEventListener() {}
  close() {}
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
  vi.stubGlobal("EventSource", EventSourceStub);
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const body = path.endsWith("/api/v1/session")
        ? { csrfToken: "csrf-token" }
        : path.endsWith("/api/v1/state")
          ? state
          : path.endsWith("/api/v1/connection")
            ? connection
            : path.endsWith("/api/v1/account")
              ? account
              : { message: `Unexpected request: ${path}` };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: path.startsWith("/api/v1/") ? 200 : 404,
          headers: { "content-type": "application/json" },
        }),
      );
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Plugin WebUI Cloud project binding", () => {
  it("renders the authoritative organization, project and explicit task budget", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "云服务" }));

    expect(
      await screen.findByRole("heading", { name: "当前工作区绑定" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "组织" })).toHaveValue(
      "org-1",
    );
    expect(screen.getByRole("combobox", { name: "Cloud 项目" })).toHaveValue(
      "project-1",
    );
    expect(
      screen.getByRole("spinbutton", { name: "任务 Credit 上限" }),
    ).toHaveValue(80);
    expect(screen.getByRole("button", { name: "更新绑定" })).toBeEnabled();
    expect(screen.getByText(/问题冻结和采集仍分别要求确认票据/)).toBeVisible();
  });
});
