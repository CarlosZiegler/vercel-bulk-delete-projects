import { describe, expect, it } from "vite-plus/test";
import { applyFilters, parseDuration } from "../../src/core/filters";
import type { Project } from "../../src/core/schemas";

function project(over: Partial<Project>): Project {
  return {
    id: "p",
    name: "x",
    framework: null,
    link: null,
    latestDeployments: undefined,
    updatedAt: 0,
    ...over,
  };
}

describe("core/filters.parseDuration", () => {
  it("parses days, months, years", () => {
    expect(parseDuration("30d")).toBe(30 * 24 * 3600 * 1000);
    expect(parseDuration("6m")).toBe(6 * 30 * 24 * 3600 * 1000);
    expect(parseDuration("1y")).toBe(365 * 24 * 3600 * 1000);
  });

  it("rejects bad inputs", () => {
    expect(() => parseDuration("")).toThrow();
    expect(() => parseDuration("abc")).toThrow();
    expect(() => parseDuration("5")).toThrow();
  });
});

describe("core/filters.applyFilters", () => {
  const now = new Date("2026-04-20T00:00:00.000Z").getTime();
  const oneYearAgo = now - 365 * 24 * 3600 * 1000;
  const oneMonthAgo = now - 30 * 24 * 3600 * 1000;

  const projects: Project[] = [
    project({
      id: "old",
      name: "old-app",
      framework: "nextjs",
      latestDeployments: [{ createdAt: oneYearAgo }],
    }),
    project({
      id: "recent",
      name: "fresh",
      framework: "vite",
      latestDeployments: [{ createdAt: oneMonthAgo }],
    }),
    project({ id: "never", name: "no-deploys", framework: "nextjs" }),
    project({
      id: "norepo",
      name: "no-git",
      framework: "vite",
      latestDeployments: [{ createdAt: now }],
      link: null,
    }),
    project({
      id: "hasrepo",
      name: "with-git",
      framework: "vite",
      latestDeployments: [{ createdAt: now }],
      link: { type: "github", repo: "x/y" },
    }),
  ];

  it("no filters returns all", () => {
    expect(applyFilters(projects, {}, now).length).toBe(projects.length);
  });

  it("older-than excludes recent, keeps old and never-deployed", () => {
    const result = applyFilters(projects, { olderThan: "6m" }, now);
    const ids = result.map((p) => p.id);
    expect(ids).toContain("old");
    expect(ids).toContain("never");
    expect(ids).not.toContain("recent");
    expect(ids).not.toContain("hasrepo");
    expect(ids).not.toContain("norepo");
  });

  it("name pattern matches glob", () => {
    const starDashApp = applyFilters(projects, { namePattern: "*-app" }, now).map((p) => p.id);
    expect(starDashApp).toEqual(["old"]);
    const startsWithNo = applyFilters(projects, { namePattern: "no-*" }, now)
      .map((p) => p.id)
      .sort();
    expect(startsWithNo).toEqual(["never", "norepo"]);
  });

  it("framework filter", () => {
    expect(
      applyFilters(projects, { framework: "nextjs" }, now)
        .map((p) => p.id)
        .sort(),
    ).toEqual(["never", "old"]);
  });

  it("no-repo filter", () => {
    const ids = applyFilters(projects, { noRepo: true }, now)
      .map((p) => p.id)
      .sort();
    expect(ids).toContain("norepo");
    expect(ids).not.toContain("hasrepo");
  });

  it("multiple filters are AND-combined", () => {
    const result = applyFilters(projects, { framework: "nextjs", olderThan: "6m" }, now);
    const ids = result.map((p) => p.id).sort();
    expect(ids).toEqual(["never", "old"]);
  });
});
