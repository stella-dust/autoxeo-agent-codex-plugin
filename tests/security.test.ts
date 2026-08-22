import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSafeProjectFile } from "../src/security.js";

describe("safe project file resolution", () => {
  let projectRoot: string;
  let outsideRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(path.join(tmpdir(), "autoxeo-project-"));
    outsideRoot = await mkdtemp(path.join(tmpdir(), "autoxeo-outside-"));
    await mkdir(path.join(projectRoot, "reports"));
    await writeFile(path.join(projectRoot, "reports", "baseline.md"), "# baseline\n");
    await writeFile(path.join(outsideRoot, "secret.md"), "secret\n");
  });

  afterEach(async () => {
    await Promise.all([
      rm(projectRoot, { recursive: true, force: true }),
      rm(outsideRoot, { recursive: true, force: true }),
    ]);
  });

  it("allows indexed preview formats inside the project", async () => {
    await expect(resolveSafeProjectFile(projectRoot, "reports/baseline.md")).resolves.toBe(
      await realpath(path.join(projectRoot, "reports", "baseline.md")),
    );
  });

  it("rejects traversal, sensitive names and unsupported formats", async () => {
    await expect(resolveSafeProjectFile(projectRoot, "../secret.md")).rejects.toThrow("PATH_OUTSIDE_PROJECT");
    await expect(resolveSafeProjectFile(projectRoot, ".env")).rejects.toThrow("SENSITIVE_FILE_BLOCKED");
    await expect(resolveSafeProjectFile(projectRoot, "image.png")).rejects.toThrow("FILE_TYPE_NOT_ALLOWED");
  });

  it("rejects symbolic link escapes", async () => {
    await symlink(path.join(outsideRoot, "secret.md"), path.join(projectRoot, "reports", "linked.md"));
    await expect(resolveSafeProjectFile(projectRoot, "reports/linked.md")).rejects.toThrow("SYMLINK_NOT_ALLOWED");
  });
});
