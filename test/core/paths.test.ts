import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { auditLogPath, configDir, configFilePath, logsDir } from "../../src/config/paths";

describe("config/paths", () => {
  const originalEnv = process.env.VERCEL_BULK_CONFIG_DIR;
  const originalCwd = process.cwd();
  let cleanCwd: string;

  beforeEach(() => {
    cleanCwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vb-cwd-")));
    process.chdir(cleanCwd);
  });

  afterEach(() => {
    process.env.VERCEL_BULK_CONFIG_DIR = originalEnv;
    process.chdir(originalCwd);
    fs.rmSync(cleanCwd, { recursive: true, force: true });
  });

  it("defaults to ~/.vercel-bulk when env var unset and no local dir", () => {
    delete process.env.VERCEL_BULK_CONFIG_DIR;
    expect(configDir()).toBe(path.join(os.homedir(), ".vercel-bulk"));
  });

  it("respects VERCEL_BULK_CONFIG_DIR override", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    expect(configDir()).toBe(tmp);
    expect(configFilePath()).toBe(path.join(tmp, "config.json"));
    expect(logsDir()).toBe(path.join(tmp, "logs"));
  });

  it("prefers local ./.vercel-bulk/ when present", () => {
    delete process.env.VERCEL_BULK_CONFIG_DIR;
    const localDir = path.join(cleanCwd, ".vercel-bulk");
    fs.mkdirSync(localDir);
    expect(configDir()).toBe(localDir);
  });

  it("walks up to find .vercel-bulk/ in an ancestor", () => {
    delete process.env.VERCEL_BULK_CONFIG_DIR;
    const ancestorLocal = path.join(cleanCwd, ".vercel-bulk");
    fs.mkdirSync(ancestorLocal);
    const nested = path.join(cleanCwd, "a", "b", "c");
    fs.mkdirSync(nested, { recursive: true });
    process.chdir(fs.realpathSync(nested));
    expect(configDir()).toBe(ancestorLocal);
  });

  it("env var wins over local dir", () => {
    const envDir = fs.mkdtempSync(path.join(os.tmpdir(), "vb-env-"));
    process.env.VERCEL_BULK_CONFIG_DIR = envDir;
    fs.mkdirSync(path.join(cleanCwd, ".vercel-bulk"));
    expect(configDir()).toBe(envDir);
  });

  it("auditLogPath uses ISO timestamp with dashes", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    const p = auditLogPath(new Date("2026-04-20T14:33:12.000Z"));
    expect(p).toBe(path.join(tmp, "logs", "deleted-2026-04-20T14-33-12Z.json"));
  });
});
