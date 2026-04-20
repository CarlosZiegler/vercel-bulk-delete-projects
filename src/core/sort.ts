import type { Project } from "./schemas";
import type { SortOptions } from "./types";

const NEVER = Number.NEGATIVE_INFINITY;

function lastDeployAt(p: Project): number {
  return p.latestDeployments?.[0]?.createdAt ?? NEVER;
}

export function sortProjects(projects: Project[], opts: SortOptions = {}): Project[] {
  const sort = opts.sort ?? "last-deploy";
  const sorted = [...projects];

  switch (sort) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "last-deploy":
      // ascending by default = oldest first (useful for cleanup)
      sorted.sort((a, b) => lastDeployAt(a) - lastDeployAt(b));
      break;
    case "updated":
      sorted.sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
      break;
  }

  if (opts.reverse) sorted.reverse();
  return sorted;
}
