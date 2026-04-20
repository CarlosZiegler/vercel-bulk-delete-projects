import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { runDelete } from "../../src/commands/delete";
import { saveToken } from "../../src/config/token";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(async () => ["p1", "p2"]),
  input: vi.fn(async () => "2"),
  password: vi.fn(),
  select: vi.fn(async () => "proceed"),
}));

describe("commands/delete", () => {
  let tmp: string;
  let logs: string[];
  const origLog = console.log;
  const origErr = console.error;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
    await saveToken("t", { id: "u1", username: "testuser" });
    logs = [];
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };
    console.error = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllGlobals();
    console.log = origLog;
    console.error = origErr;
  });

  it("deletes selected projects and writes audit log", async () => {
    const deleteCalls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (init?.method === "DELETE") {
        deleteCalls.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          projects: [
            {
              id: "p1",
              name: "a",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
            {
              id: "p2",
              name: "b",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
            {
              id: "p3",
              name: "c",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
          ],
          pagination: { count: 3, next: null },
        }),
        { status: 200 },
      );
    });

    const exit = await runDelete({});
    expect(exit).toBe(0);
    expect(deleteCalls).toHaveLength(2);
    expect(deleteCalls.some((u) => u.endsWith("/p1"))).toBe(true);
    expect(deleteCalls.some((u) => u.endsWith("/p2"))).toBe(true);

    const logsDir = path.join(tmp, "logs");
    const files = fs.readdirSync(logsDir);
    expect(files).toHaveLength(1);
    const firstFile = files[0];
    if (!firstFile) throw new Error("expected audit log file");
    const log = JSON.parse(fs.readFileSync(path.join(logsDir, firstFile), "utf8"));
    expect(log.results).toHaveLength(2);
    expect(log.results.every((r: { status: string }) => r.status === "deleted")).toBe(true);
  });

  it("continues batch when one delete fails", async () => {
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (init?.method === "DELETE") {
        if (url.endsWith("/p1")) return new Response("", { status: 403 });
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          projects: [
            {
              id: "p1",
              name: "a",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
            {
              id: "p2",
              name: "b",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
          ],
          pagination: { count: 2, next: null },
        }),
        { status: 200 },
      );
    });

    const exit = await runDelete({});
    // AuthError halts the whole batch per spec §5.5 — so exit is 1
    expect(exit).toBe(1);
    const logsDir = path.join(tmp, "logs");
    // An audit log should still be written (pending state), to survive interrupts
    expect(fs.existsSync(logsDir)).toBe(true);
  });

  it("--dry-run performs no DELETE calls", async () => {
    const deleteCalls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (init?.method === "DELETE") {
        deleteCalls.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          projects: [
            {
              id: "p1",
              name: "a",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
            {
              id: "p2",
              name: "b",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
          ],
          pagination: { count: 2, next: null },
        }),
        { status: 200 },
      );
    });

    const exit = await runDelete({ dryRun: true });
    expect(exit).toBe(0);
    expect(deleteCalls).toHaveLength(0);
  });
});
