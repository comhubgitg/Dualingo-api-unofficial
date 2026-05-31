import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadDotEnv(filePath = resolve(process.cwd(), ".env")) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getConfig() {
  return {
    host: process.env.HOST || "127.0.0.1",
    port: numberFromEnv("PORT", 3000),
    duolingoBaseUrl:
      process.env.DUOLINGO_BASE_URL || "https://www.duolingo.com",
    duolingoJwt: process.env.DUOLINGO_JWT || "",
    apiKey: process.env.API_KEY || "",
    cacheTtlSeconds: numberFromEnv("CACHE_TTL_SECONDS", 60),
    requestTimeoutMs: numberFromEnv("REQUEST_TIMEOUT_MS", 15000),
    corsOrigin: process.env.CORS_ORIGIN || "*"
  };
}
