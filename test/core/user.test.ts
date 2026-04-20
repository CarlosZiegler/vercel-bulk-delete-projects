import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { getUser } from "../../src/core/user";
import { ValidationError } from "../../src/errors";

describe("core/user.getUser", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the parsed user", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            user: { id: "u1", username: "testuser", email: "test@example.com" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    const user = await getUser("t");
    expect(user).toEqual({ id: "u1", username: "testuser", email: "test@example.com" });
  });

  it("throws ValidationError when response shape is wrong", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ wrong: "shape" }), { status: 200 }),
    );
    await expect(getUser("t")).rejects.toBeInstanceOf(ValidationError);
  });
});
