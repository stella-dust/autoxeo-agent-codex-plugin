import { z } from "zod";
import os from "node:os";
import path from "node:path";
import { resolveWorkspaceRoot } from "./workspace.js";

export const DEFAULT_CLOUD_BASE_URL = "https://agent.autoxeo.com";
export const PLUGIN_VERSION = "0.7.0";

const envSchema = z.object({
  AUTOXEO_WORKSPACE_ROOT: z.string().optional(),
  AUTOXEO_PROJECT_ROOT: z.string().optional(),
  AUTOXEO_CLOUD_BASE_URL: z.string().url().optional(),
  PLUGIN_DATA: z.string().optional(),
  AUTOXEO_LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

export interface RuntimeConfig {
  configuredProjectRoot?: string;
  cloudBaseUrl?: string;
  pluginDataRoot: string;
  mode: "cloud";
  logLevel: "error" | "warn" | "info" | "debug";
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const env = envSchema.parse(source);
  const configuredRoot = env.AUTOXEO_WORKSPACE_ROOT ?? env.AUTOXEO_PROJECT_ROOT;
  const config: RuntimeConfig = {
    ...(configuredRoot ? { configuredProjectRoot: resolveWorkspaceRoot(configuredRoot) } : {}),
    cloudBaseUrl: env.AUTOXEO_CLOUD_BASE_URL ?? DEFAULT_CLOUD_BASE_URL,
    pluginDataRoot: env.PLUGIN_DATA ?? path.join(os.homedir(), "Library", "Application Support", "AutoXEO", "CodexPlugin"),
    mode: "cloud",
    logLevel: env.AUTOXEO_LOG_LEVEL,
  };
  return config;
}

export function assertRunnableConfig(config: RuntimeConfig): void {
  if (!config.cloudBaseUrl) throw new Error("CLOUD_ORIGIN_NOT_CONFIGURED: set AUTOXEO_CLOUD_BASE_URL.");
}
