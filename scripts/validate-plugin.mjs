import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const manifest = JSON.parse(await readFile(path.join(root, ".codex-plugin/plugin.json"), "utf8"));
const errors = [];
if (manifest.name !== "autoxeo-agent") errors.push("manifest name must be autoxeo-agent");
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version ?? "")) errors.push("manifest version must be strict semver");
if (!manifest.description || !manifest.author?.name) errors.push("manifest identity is incomplete");
if (!Array.isArray(manifest.interface?.defaultPrompt) || manifest.interface.defaultPrompt.length > 3) errors.push("defaultPrompt must be an array with at most 3 entries");
if (manifest.mcpServers !== "./.mcp.json") errors.push("manifest must point to ./.mcp.json");

const mcp = JSON.parse(await readFile(path.join(root, ".mcp.json"), "utf8"));
if (mcp.mcpServers?.["autoxeo-agent"]?.args?.[0] !== "./dist/server.mjs") errors.push("MCP command must use the bundled server");
await access(path.join(root, "dist/server.mjs")).catch(() => errors.push("dist/server.mjs is missing; run npm run build"));
await access(path.join(root, "dist/ui/index.html")).catch(() => errors.push("dist/ui/index.html is missing; run npm run build"));

const skillRoot = path.join(root, "skills");
const skillNames = [];
for (const entry of await readdir(skillRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    await access(path.join(skillRoot, entry.name, "SKILL.md"));
    skillNames.push(entry.name);
  } catch {
    // Empty directories left by a source migration are not packaged as Skills.
  }
}
for (const skillName of skillNames) {
  const skillPath = path.join(skillRoot, skillName, "SKILL.md");
  const content = await readFile(skillPath, "utf8").catch(() => "");
  if (!content.startsWith("---\n") || !content.includes(`name: ${skillName}`)) errors.push(`${skillName} has invalid frontmatter`);
  if (content.includes("TODO")) errors.push(`${skillName} contains TODO placeholders`);
  await access(path.join(skillRoot, skillName, "agents/openai.yaml")).catch(() => errors.push(`${skillName} is missing agents/openai.yaml`));
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`- ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Plugin validation passed (${skillNames.length} skills)\n`);
}
