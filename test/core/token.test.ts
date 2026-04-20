import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { loadConfig, resolveToken, saveToken } from "../../src/config/token";

describe("config/token", () => {
  let tmp: string;
  const origEnv = process.env.VERCEL_TOKEN;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
  });

  afterEach(() => {
    process.env.VERCEL_TOKEN = origEnv;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns null when no token anywhere", async () => {
    expect(await resolveToken()).toBe(null);
  });

  it("returns env var when set", async () => {
    process.env.VERCEL_TOKEN = "from-env";
    expect(await resolveToken()).toEqual({ token: "from-env", source: "env" });
  });

  it("returns file contents when env unset", async () => {
    await saveToken("from-file", { id: "u1", username: "testuser" });
    expect(await resolveToken()).toEqual({ token: "from-file", source: "file" });
  });

  it("env takes precedence over file", async () => {
    await saveToken("from-file", { id: "u1", username: "testuser" });
    process.env.VERCEL_TOKEN = "from-env";
    expect(await resolveToken()).toEqual({ token: "from-env", source: "env" });
  });

  it("saves config file with mode 0600 on Unix", async () => {
    await saveToken("t", { id: "u1", username: "testuser" });
    const p = path.join(tmp, "config.json");
    expect(fs.existsSync(p)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(parsed).toEqual({ token: "t", user: { id: "u1", username: "testuser" } });
    if (process.platform !== "win32") {
      const mode = fs.statSync(p).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it("loadConfig returns null when file missing", async () => {
    expect(await loadConfig()).toBe(null);
  });

  it("loadConfig returns parsed JSON when file exists", async () => {
    await saveToken("t", { id: "u1", username: "testuser" });
    expect(await loadConfig()).toEqual({ token: "t", user: { id: "u1", username: "testuser" } });
  });
});
