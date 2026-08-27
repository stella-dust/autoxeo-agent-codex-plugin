// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectState, SetupGuide } from "../../src/contracts.js";
import { App } from "./App.js";

const timestamp = "2026-08-22T02:30:00.000Z";
const state: ProjectState = {
  schemaVersion: 2, protocolVersion: "2026-08-22.plugin.v2", revision: 3,
  project: { localRootName: "AutoXEO_Workspace", cloudId: "project-1", cloudName: "中国 GEO 运营" },
  organization: { id: "org-1", name: "AutoXEO" }, brand: { id: "brand-1", name: "AutoXEO", wiki: { status: "draft", root: "品牌知识库", entryCount: 4, evidenceCount: 6 } },
  credit: { available: 500, reserved: 0, currency: "CREDIT", authoritative: true }, task: { title: "DeepSeek 基线", budget: 80, estimatedCost: 5 },
  collection: { status: "ready", questionSetId: "questions-v1", jobId: null, receiptId: "freeze-1", provenance: "unavailable", nextAction: "运行官方平台采集预检", updatedAt: timestamp },
  artifacts: [], activity: [], updatedAt: timestamp,
};
const connection = { connected: true, evidenceStatus: "authoritative", message: "Cloud 已连接", account: { state: "signed_in", message: "已连接", deviceId: "device-1", accessExpiresAt: timestamp, refreshExpiresAt: timestamp }, runtime: { localDaemon: "online", cloudGateway: "online", queue: "available" }, platforms: [{ platform: "deepseek", label: "DeepSeek", state: "ready", search: "search enabled", detail: "官方 API 已验证" }] };
const account = { account: { id: "user-1", email: "owner@example.cn", name: "Owner", status: "active" }, organizations: [{ id: "org-1", name: "AutoXEO", role: "owner", entitlement: { planName: "内测", subscriptionStatus: "active" }, credit: { available: 500, includedPerMonth: 500, usedThisPeriod: 5 }, projects: [{ id: "project-1", name: "中国 GEO 运营", brand: { id: "brand-1", name: "AutoXEO" } }] }], links: { account: "https://agent.autoxeo.com/account", support: "https://agent.autoxeo.com/support" } };
const guide: SetupGuide = {
  version: "0.6.0",
  workspace: { state: "ready", displayPath: "~/Documents/AutoXEO_Workspace", createdAutomatically: false, layoutLanguage: "zh-CN", authority: "local_workspace" },
  progress: { completed: 5, total: 6 },
  steps: [
    { id: "plugin", label: "Codex Plugin", detail: "已加载", state: "complete" },
    { id: "workspace", label: "本地工作区", detail: "用户已确认创建 · 中文目录规范", state: "complete" },
    { id: "brand_wiki", label: "Brand Wiki", detail: "4 个实体", state: "complete" },
    { id: "account", label: "AutoXEO 账号", detail: "已连接", state: "complete" },
    { id: "project", label: "Cloud 项目", detail: "已绑定", state: "complete" },
    { id: "question_set", label: "可复测问题集", detail: "待冻结", state: "current" },
  ],
  nextAction: { kind: "copy_prompt", label: "复制问题集提示", description: "生成第一版问题集", prompt: "请生成问题集" },
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const body = url.endsWith("/api/v1/session") ? { csrfToken: "csrf" } : url.endsWith("/api/v1/state") ? state : url.endsWith("/api/v1/connection") ? connection : url.endsWith("/api/v1/get-started") ? guide : url.endsWith("/api/v1/account") ? account : {};
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Codex-native workbench", () => {
  it("states the model boundary and exposes official collections", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "启动路线" })).toBeVisible();
    expect(screen.getAllByText("~/Documents/AutoXEO_Workspace")).toHaveLength(2);
    expect(await screen.findByText("不需要 DeepSeek Chat Key")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Collections/ }));
    expect(await screen.findByRole("heading", { name: "Official collection" })).toBeVisible();
    expect(screen.getByText("官方 API 已验证")).toBeVisible();
  });

  it("requires an explicit path choice before creating the workspace", async () => {
    const notConfigured: SetupGuide = {
      ...guide,
      workspace: { state: "not_configured", displayPath: "尚未选择", createdAutomatically: false, layoutLanguage: null, authority: "local_workspace" },
      progress: { completed: 1, total: 6 },
      steps: guide.steps.map((step) => step.id === "workspace" ? { ...step, detail: "等待你在本地工作台中选择位置并确认创建", state: "current" } : step.id === "plugin" ? step : { ...step, state: "upcoming" }),
      nextAction: { kind: "select_workspace", label: "选择工作区位置", description: "选择父目录后再确认创建。" },
    };
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const body = url.endsWith("/api/v1/session") ? { csrfToken: "csrf" } : url.endsWith("/api/v1/state") ? { ...state, project: { localRootName: "尚未选择工作区", cloudId: null, cloudName: null } } : url.endsWith("/api/v1/connection") ? connection : url.endsWith("/api/v1/get-started") ? notConfigured : url.endsWith("/api/v1/account") ? account : {};
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
    }));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "创建本地工作区" })).toBeVisible();
    expect(screen.getByText("尚未写入任何工作区目录")).toBeVisible();
    expect(screen.getByRole("button", { name: /创建工作区/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("保存位置"), { target: { value: "/Users/example/Documents" } });
    expect(screen.getByText("/Users/example/Documents/AutoXEO_Workspace")).toBeVisible();
    expect(screen.getByRole("button", { name: /创建工作区/ })).toBeEnabled();
  });
});
