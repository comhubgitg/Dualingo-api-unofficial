import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DuolingoClient, DuolingoError, fieldsFromQuery, normalizeCourses, toStreak, toSummary } from "./duolingoClient.js";
import { getConfig, loadDotEnv } from "./config.js";

loadDotEnv();

const config = getConfig();
const duolingo = new DuolingoClient({
  baseUrl: config.duolingoBaseUrl,
  jwt: config.duolingoJwt,
  timeoutMs: config.requestTimeoutMs,
  cacheTtlMs: config.cacheTtlSeconds * 1000
});

export function createApp({ client = duolingo, appConfig = config } = {}) {
  return createServer(async (req, res) => {
    try {
      await routeRequest(req, res, client, appConfig);
    } catch (error) {
      sendError(res, error, appConfig);
    }
  });
}

async function routeRequest(req, res, client, appConfig) {
  setCommonHeaders(res, appConfig);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    throw httpError(405, "Method not allowed.");
  }

  if (appConfig.apiKey && req.headers["x-api-key"] !== appConfig.apiKey) {
    throw httpError(401, "Missing or invalid X-API-Key.");
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const jwt = req.headers["x-duolingo-jwt"] || req.headers.authorization || "";

  if (url.pathname === "/" || url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      name: "Dualingo API Unofficial",
      endpoints: [
        "/api/users/:username/summary",
        "/api/users/:username/streak",
        "/api/users/:username/courses",
        "/api/users/:username/raw",
        "/api/users/id/:id/summary"
      ]
    });
    return;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "users") {
    throw httpError(404, "Route not found.");
  }

  const fields = fieldsFromQuery(url.searchParams.get("fields"));

  if (parts[2] === "id" && parts[3]) {
    const user = await client.getUserById(parts[3], { fields, jwt });
    handleUserAction(res, parts[4] || "summary", user);
    return;
  }

  if (!parts[2]) {
    throw httpError(404, "Route not found.");
  }

  const user = await client.getUserByUsername(parts[2], { fields, jwt });
  handleUserAction(res, parts[3] || "summary", user);
}

function handleUserAction(res, action, user) {
  switch (action) {
    case "summary":
      sendJson(res, 200, toSummary(user));
      break;
    case "streak":
      sendJson(res, 200, toStreak(user));
      break;
    case "courses":
      sendJson(res, 200, {
        id: user?.id ?? null,
        username: user?.username ?? null,
        totalXp: user?.totalXp ?? null,
        courses: normalizeCourses(user?.courses)
      });
      break;
    case "raw":
      sendJson(res, 200, user);
      break;
    default:
      throw httpError(404, "Route not found.");
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendError(res, error, appConfig) {
  setCommonHeaders(res, appConfig);

  const status =
    error instanceof DuolingoError || error.status ? error.status : 500;
  sendJson(res, status, {
    error: {
      message: error.message || "Internal server error.",
      status,
      upstreamStatus: error.upstreamStatus,
      details: error.details
    }
  });
}

function setCommonHeaders(res, appConfig) {
  res.setHeader("Access-Control-Allow-Origin", appConfig.corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-API-Key,X-Duolingo-JWT"
  );
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const server = createApp();
  server.listen(config.port, config.host, () => {
    console.log(
      `Dualingo API Unofficial is running at http://${config.host}:${config.port}`
    );
  });
}
