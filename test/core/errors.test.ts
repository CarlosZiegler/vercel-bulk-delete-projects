import { describe, it, expect } from "vite-plus/test";
import { AuthError, RateLimitError, ApiError, ValidationError } from "../../src/errors";

describe("errors", () => {
  it("AuthError carries status and message", () => {
    const e = new AuthError(403, "forbidden");
    expect(e.name).toBe("AuthError");
    expect(e.status).toBe(403);
    expect(e.message).toBe("forbidden");
    expect(e).toBeInstanceOf(Error);
  });

  it("RateLimitError carries retryAfter seconds", () => {
    const e = new RateLimitError(30);
    expect(e.name).toBe("RateLimitError");
    expect(e.retryAfterSeconds).toBe(30);
  });

  it("ApiError carries status, endpoint, body", () => {
    const e = new ApiError(500, "/v9/projects", { message: "boom" });
    expect(e.status).toBe(500);
    expect(e.endpoint).toBe("/v9/projects");
    expect(e.body).toEqual({ message: "boom" });
  });

  it("ValidationError carries endpoint and cause", () => {
    const e = new ValidationError("/v9/projects", new Error("bad shape"));
    expect(e.endpoint).toBe("/v9/projects");
    expect(e.cause).toBeInstanceOf(Error);
  });
});
