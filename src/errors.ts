export class AuthError extends Error {
  readonly name = "AuthError";
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class RateLimitError extends Error {
  readonly name = "RateLimitError";
  constructor(public readonly retryAfterSeconds: number) {
    super(`Rate limited. Retry after ${retryAfterSeconds}s.`);
  }
}

export class ApiError extends Error {
  readonly name = "ApiError";
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly body: unknown,
  ) {
    super(`Vercel API error ${status} at ${endpoint}`);
  }
}

export class ValidationError extends Error {
  readonly name = "ValidationError";
  constructor(
    public readonly endpoint: string,
    override readonly cause: unknown,
  ) {
    super(`Response shape from ${endpoint} did not match expected schema\n  ${formatCause(cause)}`);
  }
}

function formatCause(cause: unknown): string {
  if (
    cause &&
    typeof cause === "object" &&
    "issues" in cause &&
    Array.isArray((cause as { issues: unknown[] }).issues)
  ) {
    const issues = (cause as { issues: Array<{ path: (string | number)[]; message: string }> })
      .issues;
    return issues
      .slice(0, 10)
      .map((i) => `• ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n  ");
  }
  return (cause as Error | null | undefined)?.message ?? String(cause);
}
