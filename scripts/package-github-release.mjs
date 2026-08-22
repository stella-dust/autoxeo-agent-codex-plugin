import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = pluginRoot;
const packageJson = JSON.parse(await readFile(path.join(pluginRoot, "package.json"), "utf8"));
const pluginManifest = JSON.parse(
  await readFile(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
);

if (pluginManifest.version !== packageJson.version) {
  throw new Error("package.json 与 plugin.json 版本不一致");
}

const version = packageJson.version;
const releaseDirectory = path.join(repositoryRoot, "release");
const stagingDirectory = path.join(repositoryRoot, ".autoxeo", "release-staging");
const marketplaceRoot = path.join(stagingDirectory, `autoxeo-codex-plugin-${version}`);
const bundledPluginRoot = path.join(marketplaceRoot, "plugins", "autoxeo-agent");

await rm(stagingDirectory, { recursive: true, force: true });
await mkdir(bundledPluginRoot, { recursive: true });
await mkdir(releaseDirectory, { recursive: true });

const packResult = run("npm", ["pack", "--pack-destination", releaseDirectory, "--json"], pluginRoot);
const packed = JSON.parse(packResult.stdout);
if (!Array.isArray(packed) || packed.length !== 1 || !packed[0]?.filename) {
  throw new Error("npm pack 未返回唯一制品");
}
const npmPackagePath = path.join(releaseDirectory, packed[0].filename);

run("tar", ["-xzf", npmPackagePath, "-C", bundledPluginRoot, "--strip-components=1"], repositoryRoot);
await mkdir(path.join(marketplaceRoot, ".agents", "plugins"), { recursive: true });
await cp(
  path.join(repositoryRoot, ".agents", "plugins", "marketplace.json"),
  path.join(marketplaceRoot, ".agents", "plugins", "marketplace.json"),
);
await writeFile(
  path.join(marketplaceRoot, "INSTALL.md"),
  `# AutoXEO Agent Codex Plugin ${version}\n\n` +
    `此目录是可直接注册的本地 Codex Marketplace。安装：\n\n` +
    `\`\`\`bash\n` +
    `codex plugin marketplace add /absolute/path/to/autoxeo-codex-plugin-${version}\n` +
    `codex plugin add autoxeo-agent@autoxeo\n` +
    `\`\`\`\n\n` +
    `安装或升级后请新建 Codex task。Cloud 固定默认为 https://agent.autoxeo.com；` +
    `开发环境可显式设置 AUTOXEO_CLOUD_BASE_URL 覆盖。\n`,
  "utf8",
);

const marketplaceArchive = path.join(
  releaseDirectory,
  `autoxeo-codex-plugin-marketplace-${version}.tar.gz`,
);
await rm(marketplaceArchive, { force: true });
run("tar", ["-czf", marketplaceArchive, "-C", stagingDirectory, path.basename(marketplaceRoot)], repositoryRoot);

const sbomPath = path.join(releaseDirectory, `autoxeo-codex-plugin-${version}.spdx.json`);
const sbom = run("npm", ["sbom", "--omit=dev", "--sbom-format=spdx"], pluginRoot);
await writeFile(sbomPath, sbom.stdout, "utf8");

const commit = run("git", ["rev-parse", "HEAD"], repositoryRoot).stdout.trim();
const commitTime = run("git", ["show", "-s", "--format=%cI", "HEAD"], repositoryRoot).stdout.trim();
const artifactPaths = [npmPackagePath, marketplaceArchive, sbomPath];
const artifactRecords = await Promise.all(
  artifactPaths.map(async (file) => ({ name: path.basename(file), sha256: await sha256(file) })),
);
const manifestPath = path.join(releaseDirectory, `release-manifest-${version}.json`);
await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      schemaVersion: "autoxeo-codex-plugin-release.v1",
      version,
      commit,
      commitTime,
      channel: "github-direct",
      cloudOrigin: "https://agent.autoxeo.com",
      artifacts: artifactRecords,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const checksumFiles = [...artifactPaths, manifestPath];
const checksumLines = await Promise.all(
  checksumFiles.map(async (file) => `${await sha256(file)}  ${path.basename(file)}`),
);
await writeFile(path.join(releaseDirectory, "SHA256SUMS"), `${checksumLines.join("\n")}\n`, "utf8");
await rm(stagingDirectory, { recursive: true, force: true });

process.stdout.write(`GitHub Release 制品已生成：${marketplaceArchive}\n`);

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 失败\n${result.stderr || result.stdout}`);
  }
  return result;
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}
