#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { HttpCloudClient } from "./cloud-client.js";
import { AuthSession } from "./auth-session.js";
import { loadConfig } from "./config.js";
import { WorkbenchDomain } from "./domain.js";
import { startWorkbenchServer, type WorkbenchHandle } from "./http-server.js";
import { Logger } from "./logger.js";
import { ProjectStore } from "./store.js";
import { ensureWorkspace } from "./workspace.js";

const config = loadConfig();
const logger = new Logger(config.logLevel);
await ensureWorkspace(config.projectRoot);
const auth = new AuthSession(config);
await auth.initialize();
const store = new ProjectStore(config.projectRoot);
const domain = new WorkbenchDomain(config, store, new HttpCloudClient(config, auth), auth);
await domain.initialize();

const server = new McpServer({ name: "autoxeo-agent", version: "0.5.0" });
let workbench: WorkbenchHandle | undefined;

function asToolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: typeof value === "object" && value !== null ? (value as Record<string, unknown>) : { value },
  };
}

function toolError(error: unknown, tool: string) {
  const requestId = randomUUID();
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  logger.write("warn", "mcp.tool_failed", { tool, requestId, errorCode: message.split(":")[0] });
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          code: message.split(":")[0],
          message,
          retryable: message.includes("TIMEOUT") || message.includes("HTTP_5"),
          requestId,
        }),
      },
    ],
    isError: true,
  };
}

function registerTool(
  name: string,
  definition: {
    title: string;
    description: string;
    inputSchema: z.ZodRawShape;
    annotations: {
      readOnlyHint: boolean;
      destructiveHint: boolean;
      idempotentHint: boolean;
      openWorldHint: boolean;
    };
  },
  handler: (input: Record<string, unknown>) => Promise<unknown>,
): void {
  server.registerTool(name, definition, async (input) => {
    const startedAt = Date.now();
    try {
      const value = await handler(input);
      logger.write("info", "mcp.tool_completed", { tool: name, latencyMs: Date.now() - startedAt });
      return asToolResult(value);
    } catch (error) {
      return toolError(error, name);
    }
  });
}

registerTool(
  "connection_status",
  {
    title: "检查 AutoXEO 连接",
    description: "读取插件模式、协议、Cloud 可用性和证据边界。不会返回凭据。",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  () => domain.connectionStatus(),
);

registerTool(
  "get_account_overview",
  {
    title: "读取 AutoXEO 账号权益",
    description: "读取官网账号、组织角色、当前权益、Credit、用量、配额和最近账单状态。不会展示套餐购买或发起支付。",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  () => domain.accountOverview(),
);

registerTool(
  "bind_cloud_project",
  {
    title: "绑定 Cloud 项目",
    description:
      "把当前本地 Workspace 绑定到账号中的一个组织和 Cloud 项目，并显式设置本任务 Credit 上限。不会调用平台或扣费。",
    inputSchema: {
      organizationId: z.string().min(1),
      projectId: z.string().min(1),
      taskBudget: z.number().int().nonnegative().max(100_000),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  (input) => domain.bindCloudProject(input),
);

registerTool(
  "start_account_connection",
  {
    title: "连接 AutoXEO 账号",
    description: "创建一次性设备登录码。用户在 AutoXEO 官网登录已有账号并批准，Codex 账号不参与订阅或 Credit。",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  () => domain.startAccountConnection(),
);

registerTool(
  "poll_account_connection",
  {
    title: "检查 AutoXEO 账号连接",
    description: "检查官网设备批准状态；成功后保存可撤销、可旋转的设备会话。",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  () => domain.pollAccountConnection(),
);

registerTool(
  "disconnect_account",
  {
    title: "断开 AutoXEO 账号",
    description: "删除此 Plugin 的本地设备会话。不会删除官网账号、Workspace 或 Cloud 数据。",
    inputSchema: { confirmation: z.literal("disconnect_autoxeo_account") },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  () => domain.logoutAccount(),
);

registerTool(
  "open_local_workbench",
  {
    title: "打开 AutoXEO 本地工作台",
    description: "启动或复用只监听 127.0.0.1 的本地 WebUI，并返回带一次性启动凭据的地址。",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    workbench ??= await startWorkbenchServer({ domain, logger });
    const state = await domain.state(false);
    return {
      url: workbench.url,
      project: state.project,
      mode: "codex_native",
      workspaceRoot: state.project.localRootName,
    };
  },
);

registerTool(
  "get_workspace_context",
  {
    title: "读取 Codex GEO 工作区上下文",
    description: "读取本地 Brand Wiki、Cloud 项目绑定、官方采集状态、Credit 和产物索引；不执行模型推理。",
    inputSchema: { refreshArtifacts: z.boolean().default(false) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  (input) => domain.state(input.refreshArtifacts as boolean),
);

registerTool(
  "prepare_question_set",
  {
    title: "校验并准备冻结问题集",
    description: "本地校验结构和重复项，并向 Cloud 请求短期确认票据；本步骤不冻结问题。",
    inputSchema: {
      title: z.string().min(1).max(120),
      questions: z.array(
        z.object({
          id: z.string().min(1),
          text: z.string().min(5).max(240),
          intent: z.enum(["awareness", "consideration", "comparison", "decision", "validation"]),
          persona: z.string().min(1).max(80),
          questionType: z.enum(["decision", "open", "recommendation", "negative", "comparison"]),
          brandMention: z.enum(["required", "excluded", "natural"]),
          evidenceTier: z.enum(["A", "B", "C"]),
        }),
      ).min(1).max(200),
      methodVersion: z.literal("geo-question-method-2026-08"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  (input) => domain.prepareQuestionSet(input),
);

registerTool(
  "commit_question_set",
  {
    title: "确认冻结问题集",
    description: "消费用户明确批准的短期确认票据，冻结权威问题版本并返回 Cloud Receipt。",
    inputSchema: { ticketId: z.string().min(1) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  (input) => domain.commitQuestionSet(input.ticketId as string),
);

registerTool(
  "prepare_official_collection",
  {
    title: "预检官方平台 API 采集",
    description: "检查官方 API 能力、Evidence 门、预算和 Credit 估算并返回短期确认票据；本步骤不调用平台、不扣费。",
    inputSchema: {
      questionSetId: z.string().min(1),
      platforms: z.array(z.enum(["doubao", "qwen", "deepseek", "yuanbao", "kimi"])).min(1).max(5),
      maxCredit: z.number().positive().max(100_000),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  (input) => domain.prepareCollection(input),
);

registerTool(
  "start_official_collection",
  {
    title: "确认并开始官方平台 API 采集",
    description: "消费用户明确批准的确认票据和幂等键，创建 Cloud 官方采集 Job。该操作可能预留 Credit。",
    inputSchema: { ticketId: z.string().min(1), idempotencyKey: z.string().min(8).max(160) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  (input) => domain.startCollection(input.ticketId as string, input.idempotencyKey as string),
);

registerTool(
  "get_collection_job",
  {
    title: "读取采集 Job",
    description: "按 Job ID 查询权威状态、provenance 和 Credit 结算，不修改任务。",
    inputSchema: { jobId: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  (input) => domain.getCollectionJob(input.jobId as string),
);

registerTool(
  "get_analysis_dataset",
  {
    title: "读取 GEO 分析数据集",
    description: "从 Cloud 导出确定性分析数据、方法版本和 Evidence refs；Codex 负责解释和生成产物。",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  () => domain.analysisDataset(),
);

registerTool(
  "register_local_artifact",
  {
    title: "核验本地产物",
    description: "校验项目根内的安全相对路径和 SHA-256，并写入本地活动记录；v0.1 不自动上传 Cloud。",
    inputSchema: {
      relativePath: z.string().min(1),
      expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
      title: z.string().min(1).max(160),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  (input) => domain.registerArtifact(input),
);

const transport = new StdioServerTransport();
await server.connect(transport);
logger.write("info", "mcp.started", { mode: config.mode, protocol: "2026-08-22.plugin.v2" });

async function shutdown(): Promise<void> {
  if (workbench) await workbench.close();
  await server.close();
}

process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
