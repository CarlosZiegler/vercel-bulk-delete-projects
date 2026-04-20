import { describe, expect, it } from "vite-plus/test";
import type { Project } from "../../src/core/schemas";
import { sortProjects } from "../../src/core/sort";

function p(over: Partial<Project> & { id: string; name: string }): Project {
  return {
    framework: null,
    link: null,
    latestDeployments: undefined,
    updatedAt: 0,
    ...over,
  };
}

describe("core/sort.sortProjects", () => {
  const projects: Project[] = [
    p({ id: "b", name: "banana", latestDeployments: [{ createdAt: 2000 }], updatedAt: 20 }),
    p({ id: "a", name: "apple", latestDeployments: [{ createdAt: 3000 }], updatedAt: 10 }),
    p({ id: "c", name: "cherry", latestDeployments: undefined, updatedAt: 30 }),
  ];

  it("sorts by name ascending by default", () => {
    const sorted = sortProjects(projects, { sort: "name" });
    expect(sorted.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by last-deploy ascending, undefined first (oldest first)", () => {
    const sorted = sortProjects(projects, { sort: "last-deploy" });
    expect(sorted.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("sorts by updated ascending", () => {
    const sorted = sortProjects(projects, { sort: "updated" });
    expect(sorted.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("reverse flips the order", () => {
    const sorted = sortProjects(projects, { sort: "name", reverse: true });
    expect(sorted.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("default sort is last-deploy", () => {
    const sorted = sortProjects(projects);
    expect(sorted.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate input", () => {
    const input = [...projects];
    sortProjects(input, { sort: "name" });
    expect(input.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});
