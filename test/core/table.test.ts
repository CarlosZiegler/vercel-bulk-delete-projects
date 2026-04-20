import { describe, expect, it } from "vite-plus/test";
import type { Project } from "../../src/core/schemas";
import { renderProjectTable } from "../../src/ui/table";

const now = new Date("2026-04-20T00:00:00.000Z").getTime();

describe("ui/table.renderProjectTable", () => {
  it("renders header + rows", () => {
    const projects: Project[] = [
      {
        id: "p1",
        name: "my-app",
        framework: "nextjs",
        link: { type: "github", repo: "c/m" },
        latestDeployments: [{ createdAt: now - 86400000 * 7 }],
        updatedAt: 0,
      },
      {
        id: "p2",
        name: "other",
        framework: null,
        link: null,
        latestDeployments: [],
        updatedAt: 0,
      },
    ];
    const out = renderProjectTable(projects, now);
    expect(out).toContain("Name");
    expect(out).toContain("Framework");
    expect(out).toContain("Last Deploy");
    expect(out).toContain("my-app");
    expect(out).toContain("nextjs");
    expect(out).toContain("7 days ago");
    expect(out).toContain("other");
    expect(out).toContain("never");
  });

  it("prints — when link is null", () => {
    const projects: Project[] = [
      {
        id: "p2",
        name: "other",
        framework: null,
        link: null,
        latestDeployments: [],
        updatedAt: 0,
      },
    ];
    const out = renderProjectTable(projects, now);
    expect(out).toContain("—");
  });

  it("empty list returns an empty-state message", () => {
    const out = renderProjectTable([], now);
    expect(out).toContain("No projects");
  });
});
