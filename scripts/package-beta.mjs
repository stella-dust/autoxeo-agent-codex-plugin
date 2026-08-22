import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const releaseDirectory = fileURLToPath(new URL("../release", import.meta.url));
await mkdir(releaseDirectory, { recursive: true });

await new Promise((resolve, reject) => {
  const child = spawn("npm", ["pack", "--pack-destination", releaseDirectory], { stdio: "inherit", cwd: fileURLToPath(new URL("..", import.meta.url)) });
  child.once("error", reject);
  child.once("exit", (code) => (code === 0 ? resolve(undefined) : reject(new Error(`npm pack exited ${String(code)}`))));
});
