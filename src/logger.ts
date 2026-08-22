import type { RuntimeConfig } from "./config.js";

const ranks = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type Level = keyof typeof ranks;

const sensitiveKey = /token|authorization|cookie|secret|password|content|absolutePath/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sensitiveKey.test(key) ? "[REDACTED]" : redact(item)]),
    );
  }
  return value;
}

export class Logger {
  constructor(private readonly threshold: RuntimeConfig["logLevel"]) {}

  write(level: Level, event: string, fields: Record<string, unknown> = {}): void {
    if (ranks[level] > ranks[this.threshold]) return;
    const safeFields = redact(fields) as Record<string, unknown>;
    process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level, event, ...safeFields })}\n`);
  }
}
