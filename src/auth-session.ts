import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { RuntimeConfig } from "./config.js";

const tokenPairSchema = z.object({
  accessToken: z.string().min(40),
  accessExpiresAt: z.string().datetime(),
  refreshToken: z.string().min(40),
  refreshExpiresAt: z.string().datetime(),
  deviceId: z.string().min(1),
  tokenVersion: z.number().int().positive(),
});
type TokenPair = z.infer<typeof tokenPairSchema>;

const installationSchema = z.object({
  installationId: z.string().uuid(),
  publicKey: z.string().min(100),
});

const authStartResponseSchema = z.object({
  requestToken: z.string().min(40),
  userCode: z.string(),
  verificationUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  pollIntervalSeconds: z.number().int().positive(),
});

export type AccountStatus =
  | { state: "configuration_required"; message: string }
  | { state: "signed_out"; message: string }
  | { state: "pending"; message: string; userCode: string; verificationUrl: string; expiresAt: string }
  | { state: "signed_in"; message: string; deviceId: string; accessExpiresAt: string; refreshExpiresAt: string }
  | { state: "error"; message: string };

interface PendingAuth {
  requestToken: string;
  codeVerifier: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
}

async function writePrivateJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, filePath);
}

export class AuthSession {
  private tokens: TokenPair | undefined;
  private pending: PendingAuth | undefined;
  private readonly tokenPath: string;
  private readonly installationPath: string;

  constructor(private readonly config: RuntimeConfig) {
    this.tokenPath = path.join(config.pluginDataRoot, "auth", "session.json");
    this.installationPath = path.join(config.pluginDataRoot, "auth", "installation.json");
  }

  async initialize(): Promise<void> {
    try {
      this.tokens = tokenPairSchema.parse(JSON.parse(await readFile(this.tokenPath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") await rm(this.tokenPath, { force: true });
    }
  }

  status(): AccountStatus {
    if (!this.config.cloudBaseUrl) return { state: "configuration_required", message: "尚未配置 AutoXEO Cloud 地址。" };
    if (this.pending) return {
      state: "pending",
      message: "请在官网登录 AutoXEO 账号并批准此设备。",
      userCode: this.pending.userCode,
      verificationUrl: this.pending.verificationUrl,
      expiresAt: this.pending.expiresAt,
    };
    if (!this.tokens) return { state: "signed_out", message: "登录官网已有 AutoXEO 账号后才能使用 Cloud、Credit 与正式采集。" };
    return {
      state: "signed_in",
      message: "已连接 AutoXEO 账号；Codex 账号不参与订阅和 Credit 结算。",
      deviceId: this.tokens.deviceId,
      accessExpiresAt: this.tokens.accessExpiresAt,
      refreshExpiresAt: this.tokens.refreshExpiresAt,
    };
  }

  async start(): Promise<AccountStatus> {
    if (!this.config.cloudBaseUrl) throw new Error("CLOUD_ORIGIN_NOT_CONFIGURED");
    const installation = await this.installation();
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const response = await fetch(new URL("/api/desktop/v1/auth/start", this.config.cloudBaseUrl), {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        installationId: installation.installationId,
        label: `Codex Plugin · ${os.hostname()}`.slice(0, 120),
        platform: "darwin",
        arch: process.arch === "x64" ? "x64" : "arm64",
        appVersion: "0.5.0",
        publicKey: installation.publicKey,
        codeChallenge,
      }),
    });
    if (!response.ok) throw new Error(`AUTH_START_HTTP_${response.status}`);
    const value = authStartResponseSchema.parse(await response.json());
    this.pending = { ...value, codeVerifier };
    return this.status();
  }

  async poll(): Promise<AccountStatus> {
    if (!this.config.cloudBaseUrl || !this.pending) return this.status();
    const response = await fetch(new URL("/api/desktop/v1/auth/token", this.config.cloudBaseUrl), {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestToken: this.pending.requestToken, codeVerifier: this.pending.codeVerifier }),
    });
    if (response.status === 428) return this.status();
    if (!response.ok) {
      this.pending = undefined;
      throw new Error(`AUTH_EXCHANGE_HTTP_${response.status}`);
    }
    this.tokens = tokenPairSchema.parse(await response.json());
    this.pending = undefined;
    await writePrivateJson(this.tokenPath, this.tokens);
    return this.status();
  }

  async accessToken(): Promise<string | undefined> {
    if (!this.tokens) return undefined;
    if (Date.parse(this.tokens.accessExpiresAt) > Date.now() + 60_000) return this.tokens.accessToken;
    await this.refresh();
    return this.tokens?.accessToken;
  }

  async logout(): Promise<AccountStatus> {
    this.tokens = undefined;
    this.pending = undefined;
    await rm(this.tokenPath, { force: true });
    return this.status();
  }

  private async refresh(): Promise<void> {
    if (!this.config.cloudBaseUrl || !this.tokens) return;
    const response = await fetch(new URL("/api/desktop/v1/auth/refresh", this.config.cloudBaseUrl), {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: this.tokens.deviceId, refreshToken: this.tokens.refreshToken }),
    });
    if (!response.ok) {
      await this.logout();
      throw new Error(`AUTH_REFRESH_HTTP_${response.status}`);
    }
    this.tokens = tokenPairSchema.parse(await response.json());
    await writePrivateJson(this.tokenPath, this.tokens);
  }

  private async installation(): Promise<z.infer<typeof installationSchema>> {
    try {
      return installationSchema.parse(JSON.parse(await readFile(this.installationPath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const { publicKey } = generateKeyPairSync("ed25519");
      const value = {
        installationId: randomUUID(),
        publicKey: publicKey.export({ format: "pem", type: "spki" }).toString(),
      };
      await writePrivateJson(this.installationPath, value);
      return value;
    }
  }
}
