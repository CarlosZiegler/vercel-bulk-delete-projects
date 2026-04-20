import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { runLogin } from "../../src/commands/login";

vi.mock("@inquirer/prompts", () => ({
  password: vi.fn(async () => "pasted-token"),
}));

describe("commands/login", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it("validates token and saves config", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            user: { id: "u1", username: "testuser", email: "test@example.com" },
          }),
          { status: 200 },
        ),
    );

    const exitCode = await runLogin({});
    expect(exitCode).toBe(0);

    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, "config.json"), "utf8"));
    expect(cfg.token).toBe("pasted-token");
    expect(cfg.user.username).toBe("testuser");
  });

  it("returns exit code 1 if token invalid", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 401 }));
    const exitCode = await runLogin({});
    expect(exitCode).toBe(1);
    expect(fs.existsSync(path.join(tmp, "config.json"))).toBe(false);
  });
});
