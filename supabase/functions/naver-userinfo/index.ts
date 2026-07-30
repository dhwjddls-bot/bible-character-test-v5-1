const NAVER_PROFILE_URL = "https://openapi.naver.com/v1/nid/me";

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET" }
    });
  }

  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return Response.json({ error: "missing_access_token" }, {
      status: 401,
      headers: { "Cache-Control": "no-store" }
    });
  }

  try {
    const response = await fetch(NAVER_PROFILE_URL, {
      headers: {
        Authorization: authorization,
        Accept: "application/json"
      }
    });
    const body = await response.json();
    const profile = body && body.response;

    if (!response.ok || !profile || !profile.id) {
      return Response.json({ error: "invalid_naver_profile" }, {
        status: 401,
        headers: { "Cache-Control": "no-store" }
      });
    }

    return Response.json({
      sub: String(profile.id),
      email: profile.email || undefined,
      email_verified: Boolean(profile.email),
      name: profile.name || profile.nickname || "네이버 사용자",
      preferred_username: profile.nickname || profile.name || undefined,
      picture: profile.profile_image || undefined
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (_) {
    return Response.json({ error: "naver_profile_unavailable" }, {
      status: 502,
      headers: { "Cache-Control": "no-store" }
    });
  }
});
