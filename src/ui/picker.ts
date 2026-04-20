import { checkbox } from "@inquirer/prompts";
import type { Project } from "../core/schemas";
import { humanizeAge } from "./format";

export async function pickProjects(
  projects: Project[],
  preselectedIds: Set<string>,
  nowMs: number = Date.now(),
): Promise<Project[]> {
  const choices = projects.map((p) => ({
    name: `${p.name.padEnd(30)}${(p.framework ?? "—").padEnd(12)}${humanizeAge(
      p.latestDeployments?.[0]?.createdAt ?? null,
      nowMs,
    )}`,
    value: p.id,
    checked: preselectedIds.has(p.id),
  }));

  const selectedIds = await checkbox({
    message: "Select projects to delete (space to toggle, a to toggle all, enter to confirm)",
    choices,
    pageSize: 20,
    loop: false,
  });

  const byId = new Map(projects.map((p) => [p.id, p]));
  return selectedIds.flatMap((id) => {
    const p = byId.get(id);
    return p ? [p] : [];
  });
}
