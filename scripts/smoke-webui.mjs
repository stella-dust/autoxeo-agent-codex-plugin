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
  env: { ...process.env, AUTOXEO_WORKSPACE_ROOT: path.join(projectRoot, "AutoXEO_Workspace"), AUTOXEO_LOG_LEVEL: "error" },
  stderr: "pipe",
});
const client = new Client({ name: "autoxeo-webui-smoke", version: "0.3.0" });

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
  const cookie = bootstrap.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("session cookie missing");
  const state = await fetch(new URL("/api/v1/state", url), { headers: { cookie } });
  const body = await state.json();
  if (!state.ok || body.nodes?.length !== 6) throw new Error("state contract failed");
  process.stdout.write(`WebUI smoke passed (${url.origin}, six nodes)\n`);
} finally {
  await client.close();
  await rm(projectRoot, { recursive: true, force: true });
}
