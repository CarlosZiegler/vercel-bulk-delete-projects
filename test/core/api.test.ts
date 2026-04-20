import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { vercelFetch } from "../../src/core/api";
import { AuthError, ApiError } from "../../src/errors";

describe("core/api.vercelFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds Authorization header and returns JSON", async () => {
    const spy = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", spy);

    const result = await vercelFetch("t", "GET", "/v2/user");

    expect(result).toEqual({ ok: true });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("https://api.vercel.com/v2/user");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer t" });
  });

  it("throws AuthError on 401", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: { message: "bad token" } }), { status: 401 }),
    );
    await expect(vercelFetch("t", "GET", "/v2/user")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError on 403", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 403 }));
    await expect(vercelFetch("t", "DELETE", "/v9/projects/x")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws ApiError on 4xx non-auth", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 }),
    );
    await expect(vercelFetch("t", "GET", "/v9/projects/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("returns empty object on 204 No Content", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 204 }));
    const result = await vercelFetch("t", "DELETE", "/v9/projects/x");
    expect(result).toEqual({});
  });
});

describe("core/api.vercelFetch retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries on 429 respecting Retry-After header", async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const spy = vi.fn(async () => {
      calls.push(Date.now());
      if (calls.length === 1) {
        return new Response(JSON.stringify({}), { status: 429, headers: { "retry-after": "1" } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", spy);

    const promise = vercelFetch("t", "GET", "/v2/user");
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 up to 3 times with backoff, then succeeds", async () => {
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n += 1;
      if (n < 3) return new Response("", { status: 500 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const promise = vercelFetch("t", "GET", "/v2/user");
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(n).toBe(3);
  });

  it("gives up with ApiError after 4 consecutive 5xx", async () => {
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n += 1;
      return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 502 });
    });

    const assertion = expect(vercelFetch("t", "GET", "/v2/user")).rejects.toBeInstanceOf(ApiError);
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(n).toBe(4);
  });
});
