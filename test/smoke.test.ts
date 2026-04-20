import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { describe, expect, it } from "vite-plus/test";

describe("smoke", () => {
  it("--help exits 0 and lists all commands", () => {
    const bin = path.join(process.cwd(), "dist", "cli.mjs");
    const out = spawnSync("node", [bin, "--help"], { encoding: "utf8" });
    expect(out.status).toBe(0);
    expect(out.stdout).toContain("login");
    expect(out.stdout).toContain("whoami");
    expect(out.stdout).toContain("list");
    expect(out.stdout).toContain("delete");
  });
});
