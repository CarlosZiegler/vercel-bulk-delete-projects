import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { AuditLog } from "../../src/config/audit-log";
import { listHistory } from "../../src/core/history";

function writeLog(dir: string, startedAt: string, results: AuditLog["results"]): string {
  const filename = `deleted-${startedAt.replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z")}.json`;
  const p = path.join(dir, filename);
  const log: AuditLog = {
    startedAt,
    user: { id: "u1", username: "testuser" },
    results,
  };
  fs.writeFileSync(p, JSON.stringify(log, null, 2));
  return p;
}

describe("core/history.listHistory", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns [] when logs dir does not exist", async () => {
    expect(await listHistory()).toEqual([]);
  });

  it("returns [] when logs dir is empty", async () => {
    fs.mkdirSync(path.join(tmp, "logs"));
    expect(await listHistory()).toEqual([]);
  });

  it("reads valid logs and counts statuses", async () => {
    const logsDir = path.join(tmp, "logs");
    fs.mkdirSync(logsDir);
    writeLog(logsDir, "2026-04-20T14:33:12.000Z", [
      {
        project: {
          id: "p1",
          name: "a",
          framework: null,
          link: null,
          latestDeployment: null,
          updatedAt: 0,
        },
        status: "deleted",
      },
      {
        project: {
          id: "p2",
          name: "b",
          framework: null,
          link: null,
          latestDeployment: null,
          updatedAt: 0,
        },
        status: "failed",
        error: { code: 403, message: "nope" },
      },
      {
        project: {
          id: "p3",
          name: "c",
          framework: null,
          link: null,
          latestDeployment: null,
          updatedAt: 0,
        },
        status: "already_gone",
      },
    ]);

    const entries = await listHistory();
    expect(entries).toHaveLength(1);
    const only = entries[0];
    if (!only) throw new Error("expected entry");
    expect(only.deletedCount).toBe(1);
    expect(only.failedCount).toBe(1);
    expect(only.alreadyGoneCount).toBe(1);
    expect(only.pendingCount).toBe(0);
  });

  it("sorts entries descending by startedAt", async () => {
    const logsDir = path.join(tmp, "logs");
    fs.mkdirSync(logsDir);
    writeLog(logsDir, "2026-04-20T14:33:12.000Z", []);
    writeLog(logsDir, "2026-04-21T10:00:00.000Z", []);
    writeLog(logsDir, "2026-04-19T09:00:00.000Z", []);

    const entries = await listHistory();
    expect(entries.map((e) => e.log.startedAt)).toEqual([
      "2026-04-21T10:00:00.000Z",
      "2026-04-20T14:33:12.000Z",
      "2026-04-19T09:00:00.000Z",
    ]);
  });

  it("skips files not matching deleted-*.json pattern", async () => {
    const logsDir = path.join(tmp, "logs");
    fs.mkdirSync(logsDir);
    fs.writeFileSync(path.join(logsDir, "not-a-log.txt"), "junk");
    fs.writeFileSync(path.join(logsDir, "README.md"), "unrelated");
    writeLog(logsDir, "2026-04-20T14:33:12.000Z", []);

    const entries = await listHistory();
    expect(entries).toHaveLength(1);
  });

  it("skips corrupt JSON files but keeps valid ones", async () => {
    const logsDir = path.join(tmp, "logs");
    fs.mkdirSync(logsDir);
    fs.writeFileSync(path.join(logsDir, "deleted-bad.json"), "{ this is not json");
    writeLog(logsDir, "2026-04-20T14:33:12.000Z", []);

    const entries = await listHistory();
    expect(entries).toHaveLength(1);
  });
});
