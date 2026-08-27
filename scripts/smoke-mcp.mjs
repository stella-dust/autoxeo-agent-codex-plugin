import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = await mkdtemp(path.join(tmpdir(), "autoxeo-mcp-smoke-"));
const workspaceRoot = path.join(projectRoot, "AutoXEO_Workspace");
const serverPath = process.env.AUTOXEO_SERVER_PATH ?? path.resolve("dist/server.mjs");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: { ...process.env, AUTOXEO_WORKSPACE_ROOT: "", AUTOXEO_PROJECT_ROOT: "", PLUGIN_DATA: path.join(projectRoot, "plugin-data"), AUTOXEO_LOG_LEVEL: "error" },
  stderr: "pipe",
});
const client = new Client({ name: "autoxeo-smoke", version: "0.7.0" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const names = new Set(tools.tools.map((tool) => tool.name));
  for (const required of [
    "connection_status",
    "open_local_workbench",
    "get_workspace_context",
    "prepare_question_set",
    "prepare_official_collection",
    "start_official_collection",
    "get_analysis_dataset",
  ]) {
    if (!names.has(required)) throw new Error(`missing tool ${required}`);
  }
  const status = await client.callTool({ name: "connection_status", arguments: {} });
  if (status.isError) throw new Error("connection_status returned an error");
  const snapshot = await client.callTool({ name: "get_workspace_context", arguments: { refreshArtifacts: true } });
  if (snapshot.isError) throw new Error("get_task_snapshot returned an error");
  const started = await client.callTool({ name: "get_started", arguments: {} });
  if (started.isError || !JSON.stringify(started).includes("not_configured")) throw new Error("get_started must report an unconfigured workspace");
  const opened = await client.callTool({ name: "open_local_workbench", arguments: {} });
  if (opened.isError) throw new Error("open_local_workbench returned an error");
  await stat(workspaceRoot).then(
    () => { throw new Error("Plugin startup created AutoXEO_Workspace without user confirmation"); },
    (error) => { if (error?.code !== "ENOENT") throw error; },
  );
  process.stdout.write(`MCP smoke passed (${tools.tools.length} tools)\n`);
} finally {
  await client.close();
  await rm(projectRoot, { recursive: true, force: true });
}
