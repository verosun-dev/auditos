import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { runInitialAudit } from "./core/pipeline.ts";
import type { ClaimExtractionMode } from "./types/audit.ts";

const DEFAULT_PORT = 5173;
const WEB_ROOT = resolve("web");
const UPLOAD_ROOT = resolve(".auditos/uploads");
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type AuditRequest = {
  fileName?: string;
  contentBase64?: string;
  extractor?: string;
  model?: string;
  maxSections?: number;
};

const server = createServer((request, response) => {
  void routeRequest(request, response).catch((error: unknown) => {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
});

server.listen(readPort(), () => {
  console.error(`AuditOS web app running at http://localhost:${readPort()}`);
});

async function routeRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/audit") {
    await handleAuditRequest(request, response);
    return;
  }

  if (request.method === "GET") {
    await serveStatic(url.pathname, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}

async function handleAuditRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const payload = parseAuditRequest(await readRequestBody(request));

  if (!payload.fileName || !payload.contentBase64) {
    sendJson(response, 400, { error: "fileName and contentBase64 are required" });
    return;
  }

  const fileBytes = Buffer.from(payload.contentBase64, "base64");

  if (fileBytes.length > MAX_UPLOAD_BYTES) {
    sendJson(response, 413, { error: "File is too large for the local prototype" });
    return;
  }

  const uploadDir = join(UPLOAD_ROOT, randomUUID());
  const uploadPath = join(uploadDir, safeFileName(payload.fileName));
  await mkdir(uploadDir, { recursive: true });
  await writeFile(uploadPath, fileBytes);

  const report = await runInitialAudit({
    documentPath: uploadPath,
    domain: "research",
    claimExtractionMode: parseClaimExtractionMode(payload.extractor),
    claimExtractionModel: payload.model,
    claimExtractionMaxSections: payload.maxSections,
  });

  sendJson(response, 200, report);
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  const staticPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(WEB_ROOT, `.${staticPath}`);

  if (!filePath.startsWith(WEB_ROOT)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const body = await readFile(filePath, "utf8");
    response.statusCode = 200;
    response.setHeader("content-type", contentType(filePath));
    response.end(body);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const decoder = new TextDecoder();
    let body = "";
    let receivedBytes = 0;

    request.on("data", (chunk) => {
      receivedBytes += chunk.length;

      if (receivedBytes > MAX_UPLOAD_BYTES * 2) {
        rejectBody(new Error("Request body is too large"));
        return;
      }

      body += decoder.decode(chunk, { stream: true });
    });

    request.on("end", () => {
      resolveBody(`${body}${decoder.decode()}`);
    });

    request.on("error", rejectBody);
  });
}

function parseAuditRequest(body: string): AuditRequest {
  const parsed = JSON.parse(body) as AuditRequest;
  return parsed;
}

function sendJson(response: ServerResponse, statusCode: number, data: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(data, null, 2)}\n`);
}

function safeFileName(value: string): string {
  return basename(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function contentType(filePath: string): string {
  const extension = extname(filePath);

  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }

  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".js") {
    return "application/javascript; charset=utf-8";
  }

  return "text/plain; charset=utf-8";
}

function readPort(): number {
  const parsed = Number(process.env.PORT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

function parseClaimExtractionMode(value: string | undefined): ClaimExtractionMode | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "auto" || value === "heuristic" || value === "llm") {
    return value;
  }

  throw new Error(`Unknown claim extractor mode: ${value}`);
}
