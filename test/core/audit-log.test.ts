import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { type AuditLog, writeAuditLog } from "../../src/config/audit-log";

describe("config/audit-log", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("writes log to logs/ directory, creating it if missing", async () => {
    const log: AuditLog = {
      startedAt: "2026-04-20T14:33:12.000Z",
      user: { id: "u1", username: "testuser" },
      results: [
        {
          project: {
            id: "p1",
            name: "a",
            framework: null,
            link: null,
            latestDeployment: null,
            updatedAt: 0,
          },
          status: "pending",
        },
      ],
    };
    const p = await writeAuditLog(log, new Date("2026-04-20T14:33:12.000Z"));
    expect(fs.existsSync(p)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(parsed).toEqual(log);
  });

  it("overwrites existing log at same path", async () => {
    const when = new Date("2026-04-20T14:33:12.000Z");
    const initial: AuditLog = {
      startedAt: when.toISOString(),
      user: { id: "u1", username: "testuser" },
      results: [
        {
          project: {
            id: "p1",
            name: "a",
            framework: null,
            link: null,
            latestDeployment: null,
            updatedAt: 0,
          },
          status: "pending",
        },
      ],
    };
    const p = await writeAuditLog(initial, when);
    const updated: AuditLog = {
      ...initial,
      finishedAt: "2026-04-20T14:33:19.000Z",
      results: initial.results.map((r) => ({ ...r, status: "deleted" as const })),
    };
    await writeAuditLog(updated, when);
    expect(JSON.parse(fs.readFileSync(p, "utf8"))).toEqual(updated);
  });
});
