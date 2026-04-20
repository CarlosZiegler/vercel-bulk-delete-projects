import { ApiError, AuthError, RateLimitError } from "../errors";

const BASE_URL = "https://api.vercel.com";
const MAX_RETRIES = 3;

type Method = "GET" | "POST" | "DELETE" | "PATCH";

export async function vercelFetch(
  token: string,
  method: Method,
  endpoint: string,
  body?: unknown,
): Promise<unknown> {
  let attempt = 0;

  for (;;) {
    try {
      return await attemptFetch(token, method, endpoint, body);
    } catch (e) {
      if (e instanceof RateLimitError) {
        await sleep(e.retryAfterSeconds * 1000);
        continue;
      }
      if (e instanceof ApiError && e.status >= 500 && attempt < MAX_RETRIES) {
        attempt += 1;
        await sleep(backoffMs(attempt));
        continue;
      }
      throw e;
    }
  }
}

async function attemptFetch(
  token: string,
  method: Method,
  endpoint: string,
  body: unknown,
): Promise<unknown> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return {};

  if (response.status === 401 || response.status === 403) {
    const msg = await safeText(response);
    throw new AuthError(response.status, msg || "unauthorized");
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") ?? 1);
    throw new RateLimitError(retryAfter);
  }

  if (!response.ok) {
    const bodyParsed = await safeJson(response);
    throw new ApiError(response.status, endpoint, bodyParsed);
  }

  return response.json();
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

async function safeJson(r: Response): Promise<unknown> {
  try {
    return await r.json();
  } catch {
    return null;
  }
}
