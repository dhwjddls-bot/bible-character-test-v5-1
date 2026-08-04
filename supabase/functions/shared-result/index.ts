import {
  callDatabaseFunction,
  createRateKey,
  isOriginAllowed,
  jsonResponse,
  normalizeCode,
  normalizeCreateBody,
  preflightResponse,
  readJsonBody,
  RequestError,
} from "../_shared/shared-result.ts";

function retryAfter(value: unknown): number {
  return Number.isInteger(value) && (value as number) > 0
    ? Math.min(value as number, 600)
    : 60;
}

function databaseErrorResponse(request: Request, result: Record<string, unknown>): Response {
  const error = typeof result.error === "string" ? result.error : "service_unavailable";

  if (error === "rate_limited") {
    const seconds = retryAfter(result.retryAfter);
    return jsonResponse(
      request,
      { error: "rate_limited", retryAfter: seconds },
      429,
      { "Retry-After": String(seconds) },
    );
  }

  if (error === "not_found") return jsonResponse(request, { error: "not_found" }, 404);
  if (error === "invalid_code") return jsonResponse(request, { error: "invalid_code" }, 400);
  if (error === "invalid_payload") return jsonResponse(request, { error: "invalid_payload" }, 400);
  return jsonResponse(request, { error: "service_unavailable" }, 503);
}

async function createResult(request: Request): Promise<Response> {
  if (new URL(request.url).search) throw new RequestError(400, "invalid_payload");
  const body = await readJsonBody(request);
  const payload = normalizeCreateBody(body);
  const rateKey = await createRateKey(request);
  const result = await callDatabaseFunction("create_shared_result", {
    p_payload: payload,
    p_rate_key: rateKey,
  });

  if (result.ok !== true) return databaseErrorResponse(request, result);
  if (typeof result.code !== "string" || typeof result.expiresAt !== "string") {
    throw new RequestError(503, "service_unavailable");
  }

  return jsonResponse(
    request,
    { code: result.code, expiresAt: result.expiresAt },
    201,
  );
}

async function resolveResult(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const codeValues = url.searchParams.getAll("code");
  const queryKeys = [...url.searchParams.keys()];
  if (codeValues.length !== 1 || queryKeys.some((key) => key !== "code")) {
    throw new RequestError(400, "invalid_code");
  }

  const code = normalizeCode(codeValues[0]);
  const rateKey = await createRateKey(request);
  const result = await callDatabaseFunction("resolve_shared_result", {
    p_code: code,
    p_rate_key: rateKey,
  });

  if (result.ok !== true) return databaseErrorResponse(request, result);
  if (typeof result.expiresAt !== "string" || typeof result.payload !== "object" || !result.payload) {
    throw new RequestError(503, "service_unavailable");
  }

  return jsonResponse(request, {
    payload: result.payload,
    expiresAt: result.expiresAt,
  });
}

Deno.serve(async (request: Request) => {
  if (!isOriginAllowed(request)) {
    return jsonResponse(request, { error: "origin_not_allowed" }, 403);
  }

  if (request.method === "OPTIONS") return preflightResponse(request);

  try {
    if (request.method === "POST") return await createResult(request);
    if (request.method === "GET") return await resolveResult(request);

    return jsonResponse(
      request,
      { error: "method_not_allowed" },
      405,
      { Allow: "GET, POST, OPTIONS" },
    );
  } catch (error) {
    if (error instanceof RequestError) {
      return jsonResponse(request, { error: error.code }, error.status);
    }
    return jsonResponse(request, { error: "service_unavailable" }, 503);
  }
});
