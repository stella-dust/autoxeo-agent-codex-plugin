import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { WorkbenchDomain } from "./domain.js";
import type { Logger } from "./logger.js";
import { constantTimeEqual, randomToken } from "./security.js";

const bootstrapSchema = z.object({ token: z.string().min(32) });
const commandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("choose_workspace_parent") }),
  z.object({ command: z.literal("create_workspace"), parentPath: z.string().min(1).max(4096), confirmation: z.literal("create_autoxeo_workspace") }),
  z.object({ command: z.literal("connect_existing_workspace") }),
  z.object({ command: z.literal("refresh_artifacts") }),
  z.object({ command: z.literal("start_account_connection") }),
  z.object({ command: z.literal("poll_account_connection") }),
  z.object({ command: z.literal("disconnect_account"), confirmation: z.literal("disconnect_autoxeo_account") }),
  z.object({
    command: z.literal("bind_cloud_project"),
    organizationId: z.string().min(1),
    projectId: z.string().min(1),
    taskBudget: z.number().int().nonnegative().max(100_000),
  }),
  z.object({
    command: z.literal("prepare_official_collection"),
    questionSetId: z.string().default("questions-fixture-v1"),
    platforms: z.array(z.enum(["doubao", "qwen", "deepseek", "yuanbao", "kimi"])).default(["deepseek"]),
    maxCredit: z.number().positive().default(120),
  }),
  z.object({ command: z.literal("start_official_collection"), ticketId: z.string().min(1), idempotencyKey: z.string().min(8) }),
]);

interface WorkbenchServerOptions {
  domain: WorkbenchDomain;
  logger: Logger;
  uiRoot?: string;
}

export interface WorkbenchHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

function getDefaultUiRoot(): string {
  const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(sourceDirectory, "ui");
}

function json(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > 64_000) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function cookieValue(request: IncomingMessage, name: string): string | undefined {
  const cookie = request.headers.cookie;
  if (!cookie) return undefined;
  for (const item of cookie.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

export async function startWorkbenchServer(options: WorkbenchServerOptions): Promise<WorkbenchHandle> {
  const launchToken = randomToken();
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const uiRoot = options.uiRoot ?? getDefaultUiRoot();

  // Node's request listener is intentionally async; every branch writes or ends the response.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const server = createServer(async (request, response) => {
    const startedAt = Date.now();
    const requestId = randomToken(12);
    const host = request.headers.host ?? "";
    const serverAddress = server.address();
    const expectedPort = serverAddress && typeof serverAddress === "object" ? serverAddress.port : "";
    const expectedHost = `127.0.0.1:${expectedPort}`;
    const url = new URL(request.url ?? "/", `http://${host || expectedHost}`);

    response.setHeader(
      "content-security-policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("x-frame-options", "DENY");

    try {
      if (host !== expectedHost) {
        json(response, 403, { code: "HOST_REJECTED", requestId });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/health") {
        json(response, 200, { ok: true, service: "autoxeo-local-workbench", requestId });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/v1/session/bootstrap") {
        const origin = request.headers.origin;
        if (origin !== `http://${expectedHost}`) throw new Error("ORIGIN_REJECTED");
        const input = bootstrapSchema.parse(await readJson(request));
        if (!constantTimeEqual(input.token, launchToken)) throw new Error("SESSION_BOOTSTRAP_REJECTED");
        json(
          response,
          200,
          { csrfToken },
          { "set-cookie": `autoxeo_session=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Strict; Path=/` },
        );
        return;
      }

      if (url.pathname.startsWith("/api/v1/")) {
        const session = cookieValue(request, "autoxeo_session");
        if (!session || !constantTimeEqual(session, sessionToken)) throw new Error("SESSION_REQUIRED");
        const origin = request.headers.origin;
        if (origin && origin !== `http://${expectedHost}`) throw new Error("ORIGIN_REJECTED");
      }

      if (request.method === "GET" && url.pathname === "/api/v1/session") {
        json(response, 200, { csrfToken });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/state") {
        json(response, 200, await options.domain.state(false));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/get-started") {
        json(response, 200, await options.domain.getStarted());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/connection") {
        json(response, 200, await options.domain.connectionStatus());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/account") {
        json(response, 200, await options.domain.accountOverview());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/artifacts/preview") {
        const relativePath = url.searchParams.get("path");
        if (!relativePath) throw new Error("PATH_REQUIRED");
        json(response, 200, await options.domain.readArtifact(relativePath));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/events") {
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          "connection": "keep-alive",
        });
        response.write(": connected\n\n");
        const listener = (event: unknown) => response.write(`event: state\ndata: ${JSON.stringify(event)}\n\n`);
        options.domain.events.on("event", listener);
        const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 15_000);
        request.on("close", () => {
          clearInterval(heartbeat);
          options.domain.events.off("event", listener);
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/v1/commands") {
        const csrf = request.headers["x-autoxeo-csrf"];
        if (typeof csrf !== "string" || !constantTimeEqual(csrf, csrfToken)) throw new Error("CSRF_REJECTED");
        const command = commandSchema.parse(await readJson(request));
        if (command.command === "choose_workspace_parent") {
          json(response, 200, await options.domain.chooseWorkspaceParent());
          return;
        }
        if (command.command === "create_workspace") {
          json(response, 200, await options.domain.createSelectedWorkspace(command.parentPath));
          return;
        }
        if (command.command === "connect_existing_workspace") {
          json(response, 200, await options.domain.chooseAndConnectExistingWorkspace());
          return;
        }
        if (command.command === "refresh_artifacts") {
          json(response, 200, await options.domain.state(true));
          return;
        }
        if (command.command === "start_account_connection") {
          json(response, 200, await options.domain.startAccountConnection());
          return;
        }
        if (command.command === "poll_account_connection") {
          json(response, 200, await options.domain.pollAccountConnection());
          return;
        }
        if (command.command === "disconnect_account") {
          json(response, 200, await options.domain.logoutAccount());
          return;
        }
        if (command.command === "bind_cloud_project") {
          json(response, 200, await options.domain.bindCloudProject(command));
          return;
        }
        if (command.command === "prepare_official_collection") {
          json(
            response,
            200,
            await options.domain.prepareCollection({
              questionSetId: command.questionSetId,
              platforms: command.platforms,
              maxCredit: command.maxCredit,
            }),
          );
          return;
        }
        json(response, 200, await options.domain.startCollection(command.ticketId, command.idempotencyKey));
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        json(response, 405, { code: "METHOD_NOT_ALLOWED", requestId });
        return;
      }

      const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const candidate = path.resolve(uiRoot, requested);
      const root = path.resolve(uiRoot);
      if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) throw new Error("STATIC_PATH_REJECTED");
      let target = candidate;
      try {
        const metadata = await stat(target);
        if (metadata.isDirectory()) target = path.join(target, "index.html");
      } catch {
        target = path.join(root, "index.html");
      }
      const body = await readFile(target);
      response.writeHead(200, {
        "content-type": contentType(target),
        "cache-control": target.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      });
      if (request.method === "HEAD") response.end();
      else response.end(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      const status = message.includes("SESSION") || message.includes("CSRF") ? 401 : message.includes("NOT_FOUND") ? 404 : 400;
      const workspaceMessages: Record<string, string> = {
        WORKSPACE_NOT_CONFIGURED: "请先在本地工作台中选择位置并创建工作区。",
        WORKSPACE_PATH_MUST_BE_ABSOLUTE: "请输入绝对路径，或使用“在 Finder 中选择”。",
        WORKSPACE_PARENT_NOT_A_DIRECTORY: "所选位置不是可用文件夹。",
        WORKSPACE_ALREADY_EXISTS: "该位置已有内容。请选择其他位置，或使用“连接已有工作区”。",
        WORKSPACE_DIRECTORY_NAME_REQUIRED: "请选择名称为 AutoXEO_Workspace 的已有工作区。",
        WORKSPACE_MIGRATION_REQUIRED: "该工作区版本暂不受支持，未进行任何迁移。",
        FOLDER_SELECTION_CANCELLED: "未选择文件夹；没有创建或修改任何目录。",
        FOLDER_PICKER_TIMEOUT: "文件夹选择已超时；没有创建或修改任何目录。",
      };
      const errorCode = message.split(":")[0] ?? "UNKNOWN_ERROR";
      options.logger.write("warn", "webui.request_failed", {
        requestId,
        route: url.pathname,
        status,
        errorCode,
        latencyMs: Date.now() - startedAt,
      });
      json(response, status, { code: errorCode, message: workspaceMessages[errorCode] ?? "本地工作台请求失败，请刷新或重新打开工作台。", requestId });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("WORKBENCH_LISTEN_FAILED");
  const url = `http://127.0.0.1:${address.port}/#session=${launchToken}`;
  options.logger.write("info", "webui.started", { port: address.port });
  return {
    url,
    port: address.port,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
