import path from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = process.env.AUTOXEO_WORKSPACE_ROOT ?? path.join(tmpdir(), "AutoXEO_Workspace");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.resolve("dist/server.mjs")],
  env: { ...process.env, AUTOXEO_WORKSPACE_ROOT: projectRoot, AUTOXEO_LOG_LEVEL: "info" },
  stderr: "inherit",
});
const client = new Client({ name: "autoxeo-preview", version: "0.3.0" });
await client.connect(transport);
const opened = await client.callTool({ name: "open_local_workbench", arguments: {} });
const block = opened.content.find((item) => item.type === "text");
if (!block || block.type !== "text") throw new Error("workbench URL missing");
const payload = JSON.parse(block.text);
process.stdout.write(`${payload.url}\n`);

const shutdown = async () => {
  await client.close();
  process.exit(0);
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
await new Promise(() => undefined);
