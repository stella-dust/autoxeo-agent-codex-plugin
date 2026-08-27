import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = await mkdtemp(path.join(tmpdir(), "autoxeo-webui-smoke-"));
const serverPath = process.env.AUTOXEO_SERVER_PATH ?? path.resolve("dist/server.mjs");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: { ...process.env, AUTOXEO_WORKSPACE_ROOT: "", AUTOXEO_PROJECT_ROOT: "", PLUGIN_DATA: path.join(projectRoot, "plugin-data"), AUTOXEO_LOG_LEVEL: "error" },
  stderr: "pipe",
});
const client = new Client({ name: "autoxeo-webui-smoke", version: "0.7.0" });

try {
  await client.connect(transport);
  const opened = await client.callTool({ name: "open_local_workbench", arguments: {} });
  if (opened.isError) throw new Error("open_local_workbench returned an error");
  const block = opened.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") throw new Error("workbench URL missing");
  const payload = JSON.parse(block.text);
  const url = new URL(payload.url);
  const token = new URLSearchParams(url.hash.slice(1)).get("session");
  if (!token) throw new Error("session token missing");
  url.hash = "";
  const health = await fetch(new URL("/api/v1/health", url));
  if (!health.ok) throw new Error(`health failed ${health.status}`);
  const bootstrap = await fetch(new URL("/api/v1/session/bootstrap", url), {
    method: "POST",
    headers: { "content-type": "application/json", origin: url.origin },
    body: JSON.stringify({ token }),
  });
  if (!bootstrap.ok) throw new Error(`bootstrap failed ${bootstrap.status}`);
  const session = await bootstrap.json();
  const cookie = bootstrap.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("session cookie missing");
  const state = await fetch(new URL("/api/v1/state", url), { headers: { cookie } });
  const body = await state.json();
  if (
    !state.ok ||
    body.schemaVersion !== 2 ||
    body.protocolVersion !== "2026-08-22.plugin.v2" ||
    !body.brand?.wiki ||
    !Array.isArray(body.artifacts) ||
    !body.collection
  ) {
    throw new Error("state contract failed");
  }
  const guide = await fetch(new URL("/api/v1/get-started", url), { headers: { cookie } }).then((response) => response.json());
  if (guide.workspace?.state !== "not_configured") throw new Error("workbench must start without a workspace");
  const created = await fetch(new URL("/api/v1/commands", url), {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: url.origin, "x-autoxeo-csrf": session.csrfToken },
    body: JSON.stringify({ command: "create_workspace", parentPath: projectRoot, confirmation: "create_autoxeo_workspace" }),
  });
  if (!created.ok) throw new Error(`explicit workspace creation failed ${created.status}: ${await created.text()}`);
  const createdState = await fetch(new URL("/api/v1/state", url), { headers: { cookie } }).then((response) => response.json());
  if (createdState.brand?.wiki?.root !== "品牌知识库") throw new Error("Chinese workspace contract failed");
  process.stdout.write(`WebUI smoke passed (${url.origin}, explicit Chinese workspace)\n`);
} finally {
  await client.close();
  await rm(projectRoot, { recursive: true, force: true });
}
