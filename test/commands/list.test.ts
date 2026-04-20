import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { runList } from "../../src/commands/list";
import { saveToken } from "../../src/config/token";

describe("commands/list", () => {
  let tmp: string;
  let logs: string[];
  const origLog = console.log;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
    await saveToken("t", { id: "u1", username: "testuser" });
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

  it("renders a table of projects", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            projects: [
              {
                id: "p1",
                name: "my-app",
                framework: "nextjs",
                link: null,
                latestDeployments: [],
                updatedAt: 0,
              },
            ],
            pagination: { count: 1, next: null },
          }),
          { status: 200 },
        ),
    );

    const exit = await runList({});
    expect(exit).toBe(0);
    const out = logs.join("\n");
    expect(out).toContain("my-app");
    expect(out).toContain("nextjs");
    expect(out).toContain("1 project");
  });

  it("--json outputs JSON", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            projects: [
              {
                id: "p1",
                name: "my-app",
                framework: "nextjs",
                link: null,
                latestDeployments: [],
                updatedAt: 0,
              },
            ],
            pagination: { count: 1, next: null },
          }),
          { status: 200 },
        ),
    );

    const exit = await runList({ json: true });
    expect(exit).toBe(0);
    const parsed = JSON.parse(logs.join(""));
    expect(parsed[0].name).toBe("my-app");
  });
});
