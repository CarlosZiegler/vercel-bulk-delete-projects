import { describe, it, expect } from "vite-plus/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { UserResponse, ProjectListResponse, Project } from "../../src/core/schemas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "..", "fixtures");

describe("core/schemas", () => {
  it("parses user fixture", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(fixtures, "user.json"), "utf8"));
    const parsed = UserResponse.parse(raw);
    expect(parsed.user.username).toBe("testuser");
  });

  it("parses project-list fixture", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(fixtures, "projects.json"), "utf8"));
    const parsed = ProjectListResponse.parse(raw);
    expect(parsed.projects).toHaveLength(2);
    expect(parsed.projects[0]!.name).toBe("my-hackathon-2024");
    expect(parsed.projects[0]!.link?.type).toBe("github");
    expect(parsed.projects[1]!.link).toBe(null);
  });

  it("Project schema tolerates missing latestDeployments", () => {
    const parsed = Project.parse({
      id: "p",
      name: "x",
      framework: null,
      link: null,
      updatedAt: 0,
    });
    expect(parsed.latestDeployments).toBeUndefined();
  });

  it("rejects missing required fields", () => {
    expect(() => Project.parse({ id: "p" })).toThrow();
  });
});
