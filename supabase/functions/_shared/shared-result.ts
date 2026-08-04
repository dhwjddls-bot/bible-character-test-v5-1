const DEFAULT_ALLOWED_ORIGINS = ["https://dhwjddls-bot.github.io"];
const MAX_BODY_BYTES = 2048;
const CHARACTER_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const CODE_PATTERN = /^[2-9A-HJ-NP-Z]{6}$/;
const ALLOWED_QUESTION_COUNTS = new Set([16, 32, 48, 64]);
const SCORING_VERSION = "v5.2-100";
const QUESTION_BANK_VERSION = "v5.1";

type JsonObject = Record<string, unknown>;
type ResultPair = [string, number];

export interface SharedResultPayload {
  v: 2;
  s: string;
  b: string;
  q: number;
  r: [ResultPair, ResultPair, ResultPair];
  d: ResultPair | null;
}

export class RequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "RequestError";
    this.status = status;
    this.code = code;
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: JsonObject,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => allowed.has(key));
}

function parsePair(value: unknown): ResultPair | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [character, score] = value;
  if (typeof character !== "string" || !CHARACTER_ID_PATTERN.test(character)) return null;
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > 100) return null;
  return [character, score as number];
}

export function normalizeCreateBody(value: unknown): SharedResultPayload {
  if (!isObject(value) || !hasExactKeys(value, ["payload"])) {
    throw new RequestError(400, "invalid_payload");
  }

  const raw = value.payload;
  if (!isObject(raw) || !hasExactKeys(raw, ["v", "s", "q", "r"], ["b", "d"])) {
    throw new RequestError(400, "invalid_payload");
  }

  if (raw.v !== 2 || raw.s !== SCORING_VERSION) {
    throw new RequestError(400, "invalid_payload");
  }

  const questionBankVersion = raw.b === undefined ? QUESTION_BANK_VERSION : raw.b;
  if (questionBankVersion !== QUESTION_BANK_VERSION) {
    throw new RequestError(400, "invalid_payload");
  }

  if (!Number.isInteger(raw.q) || !ALLOWED_QUESTION_COUNTS.has(raw.q as number)) {
    throw new RequestError(400, "invalid_payload");
  }

  if (!Array.isArray(raw.r) || raw.r.length !== 3) {
    throw new RequestError(400, "invalid_payload");
  }

  const first = parsePair(raw.r[0]);
  const second = parsePair(raw.r[1]);
  const third = parsePair(raw.r[2]);
  if (!first || !second || !third) throw new RequestError(400, "invalid_payload");

  const ranked: [ResultPair, ResultPair, ResultPair] = [first, second, third];
  const rankedIds = new Set(ranked.map(([id]) => id));
  if (rankedIds.size !== 3 || first[1] < second[1] || second[1] < third[1]) {
    throw new RequestError(400, "invalid_payload");
  }

  let discovery: ResultPair | null = null;
  if (raw.d !== undefined && raw.d !== null) {
    discovery = parsePair(raw.d);
    if (!discovery || rankedIds.has(discovery[0])) {
      throw new RequestError(400, "invalid_payload");
    }
  }

  return {
    v: 2,
    s: raw.s,
    b: questionBankVersion,
    q: raw.q as number,
    r: ranked,
    d: discovery,
  };
}

export function normalizeCode(value: string | null): string {
  const code = (value || "").trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) throw new RequestError(400, "invalid_code");
  return code;
}

function configuredOrigins(): Set<string> {
  const raw = Deno.env.get("SHARE_ALLOWED_ORIGINS") || DEFAULT_ALLOWED_ORIGINS.join(",");
  const origins = new Set<string>();

  for (const entry of raw.split(",")) {
    const candidate = entry.trim();
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        origins.add(parsed.origin);
      }
    } catch {
      // Ignore malformed configuration entries. A wildcard is never accepted.
    }
  }

  return origins;
}

export function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return configuredOrigins().has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export function responseHeaders(request: Request, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Vary", "Origin");
  headers.set("X-Content-Type-Options", "nosniff");

  const origin = request.headers.get("origin");
  if (origin && isOriginAllowed(request)) {
    headers.set("Access-Control-Allow-Origin", new URL(origin).origin);
    headers.set(
      "Access-Control-Allow-Headers",
      "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    );
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Max-Age", "600");
  }

  return headers;
}

export function jsonResponse(
  request: Request,
  body: JsonObject,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, extraHeaders),
  });
}

export function preflightResponse(request: Request): Response {
  const headers = responseHeaders(request);
  headers.delete("Content-Type");
  return new Response(null, { status: 204, headers });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
    throw new RequestError(415, "unsupported_media_type");
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestError(413, "payload_too_large");
  }
  if (!request.body) throw new RequestError(400, "invalid_payload");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RequestError(413, "payload_too_large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text);
  } catch {
    throw new RequestError(400, "invalid_payload");
  }
}

function validIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
}

function normalizeAddress(value: string): string | null {
  let candidate = value.split(",", 1)[0].trim().toLowerCase();
  const bracketed = candidate.match(/^\[([0-9a-f:]+)\](?::\d+)?$/);
  if (bracketed) candidate = bracketed[1];

  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) candidate = ipv4WithPort[1];

  if (validIpv4(candidate)) return candidate;
  if (candidate.includes(":") && candidate.length <= 64 && /^[0-9a-f:]+$/.test(candidate)) {
    return candidate;
  }
  return null;
}

function clientAddress(request: Request): string {
  for (const header of ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]) {
    const value = request.headers.get(header);
    if (!value) continue;
    const normalized = normalizeAddress(value);
    if (normalized) return normalized;
  }
  return "unavailable";
}

export async function createRateKey(request: Request): Promise<string> {
  const secret = Deno.env.get("SHARE_RATE_LIMIT_SECRET") || "";
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new RequestError(503, "service_unavailable");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`shared-result-rate:v1:${clientAddress(request)}`),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function callDatabaseFunction(
  name: "create_shared_result" | "resolve_shared_result",
  args: JsonObject,
): Promise<JsonObject> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) throw new RequestError(503, "service_unavailable");

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(args),
    });
  } catch {
    throw new RequestError(503, "service_unavailable");
  }

  if (!response.ok) throw new RequestError(503, "service_unavailable");

  try {
    const result: unknown = await response.json();
    if (!isObject(result)) throw new Error("invalid database response");
    return result;
  } catch {
    throw new RequestError(503, "service_unavailable");
  }
}
