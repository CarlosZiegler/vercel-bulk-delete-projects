import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { saveToken } from "../../src/config/token";
import { runWhoami } from "../../src/commands/whoami";

describe("commands/whoami", () => {
  let tmp: string;
  let logs: string[];
  const origLog = console.log;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
    logs = [];
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllGlobals();
    console.log = origLog;
  });

  it("prints username when token works", async () => {
    await saveToken("t", { id: "u1", username: "testuser" });
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

    const exit = await runWhoami({});
    expect(exit).toBe(0);
    expect(logs.join("\n")).toContain("testuser");
    expect(logs.join("\n")).toContain("test@example.com");
  });

  it("errors if no token anywhere", async () => {
    const errs: string[] = [];
    const origErr = console.error;
    console.error = (...args: unknown[]) => {
      errs.push(args.join(" "));
    };
    try {
      const exit = await runWhoami({});
      expect(exit).toBe(1);
      expect(errs.join("\n").toLowerCase()).toContain("no vercel token");
    } finally {
      console.error = origErr;
    }
  });
});
