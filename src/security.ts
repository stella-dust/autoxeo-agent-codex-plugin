import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

const blockedNames = new Set([".env", ".npmrc", ".git-credentials", "id_rsa", "id_ed25519"]);
const allowedExtensions = new Set([".md", ".markdown", ".json", ".csv", ".html"]);

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function resolveSafeProjectFile(projectRoot: string, relativePath: string): Promise<string> {
  if (path.isAbsolute(relativePath) || relativePath.includes("\0")) throw new Error("INVALID_PATH");
  const normalized = path.normalize(relativePath);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) throw new Error("PATH_OUTSIDE_PROJECT");
  if (normalized.split(path.sep).some((part) => blockedNames.has(part))) throw new Error("SENSITIVE_FILE_BLOCKED");
  if (!allowedExtensions.has(path.extname(normalized).toLowerCase())) throw new Error("FILE_TYPE_NOT_ALLOWED");

  const root = await realpath(projectRoot);
  const candidate = path.resolve(root, normalized);
  const metadata = await lstat(candidate);
  if (metadata.isSymbolicLink()) throw new Error("SYMLINK_NOT_ALLOWED");
  const resolved = await realpath(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("PATH_OUTSIDE_PROJECT");
  return resolved;
}

export function safeDisplayRoot(projectRoot: string): string {
  return path.basename(projectRoot) || "project";
}
