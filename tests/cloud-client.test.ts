import { describe, expect, it } from "vitest";
import { AuthSession } from "../src/auth-session.js";
import { HttpCloudClient } from "../src/cloud-client.js";
import type { RuntimeConfig } from "../src/config.js";

describe("HttpCloudClient", () => {
  it("fails closed while the AutoXEO account is signed out", async () => {
    const config: RuntimeConfig = { pluginDataRoot: "/tmp/autoxeo-test/data", mode: "cloud", logLevel: "error" };
    const auth = new AuthSession(config);
    const client = new HttpCloudClient(config, auth);
    await expect(client.connectionStatus()).resolves.toMatchObject({
      connected: false,
      mode: "cloud",
      evidenceStatus: "unavailable",
      captureChannel: "unavailable",
      account: { state: "configuration_required" },
    });
  });
});
