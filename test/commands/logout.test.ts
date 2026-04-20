import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { runLogout } from "../../src/commands/logout";
import { saveToken } from "../../src/config/token";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(async () => true),
  password: vi.fn(),
  checkbox: vi.fn(),
  input: vi.fn(),
  select: vi.fn(),
}));

describe("commands/logout", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it("removes config.json when it exists", async () => {
    await saveToken("t", { id: "u1", username: "testuser" });
    expect(fs.existsSync(path.join(tmp, "config.json"))).toBe(true);

    const exit = await runLogout({ yes: true });
    expect(exit).toBe(0);
    expect(fs.existsSync(path.join(tmp, "config.json"))).toBe(false);
  });

  it("is a no-op when config missing", async () => {
    const exit = await runLogout({ yes: true });
    expect(exit).toBe(0);
  });

  it("leaves audit logs alone by default", async () => {
    await saveToken("t", { id: "u1", username: "testuser" });
    fs.mkdirSync(path.join(tmp, "logs"));
    fs.writeFileSync(path.join(tmp, "logs", "deleted-2026-04-20T14-33-12Z.json"), "{}");

    const exit = await runLogout({ yes: true });
    expect(exit).toBe(0);
    expect(fs.existsSync(path.join(tmp, "logs"))).toBe(true);
  });

  it("--all also removes audit logs", async () => {
    await saveToken("t", { id: "u1", username: "testuser" });
    fs.mkdirSync(path.join(tmp, "logs"));
    fs.writeFileSync(path.join(tmp, "logs", "deleted-2026-04-20T14-33-12Z.json"), "{}");

    const exit = await runLogout({ yes: true, all: true });
    expect(exit).toBe(0);
    expect(fs.existsSync(path.join(tmp, "config.json"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, "logs"))).toBe(false);
  });
});
