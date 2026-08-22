import { describe, expect, it } from "vitest";
import { DEFAULT_CLOUD_BASE_URL, loadConfig } from "../src/config.js";

describe("runtime config", () => {
  it("uses the production AutoXEO Cloud origin by default", () => {
    const config = loadConfig({});
    expect(config.cloudBaseUrl).toBe(DEFAULT_CLOUD_BASE_URL);
  });

  it("allows an explicit development origin", () => {
    const config = loadConfig({ AUTOXEO_CLOUD_BASE_URL: "http://127.0.0.1:3000" });
    expect(config.cloudBaseUrl).toBe("http://127.0.0.1:3000");
  });
});
