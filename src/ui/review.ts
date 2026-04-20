import { checkbox, select } from "@inquirer/prompts";
import type { Project } from "../core/schemas";
import { colors, humanizeAge } from "./format";

function row(p: Project, nowMs: number): string {
  const age = humanizeAge(p.latestDeployments?.[0]?.createdAt ?? null, nowMs);
  return `${p.name.padEnd(35)}${(p.framework ?? "—").padEnd(12)}${age}`;
}

export async function reviewSelection(
  initial: Project[],
  nowMs: number = Date.now(),
): Promise<Project[] | null> {
  let current = initial;

  for (;;) {
    if (current.length === 0) {
      console.log(colors.yellow("\nNo projects left in the selection. Cancelling."));
      return null;
    }

    console.log(colors.bold(`\nYou selected ${current.length} project(s) to delete:\n`));
    for (const p of current) {
      console.log(`  ${colors.red("•")} ${row(p, nowMs)}`);
    }
    console.log();

    const action = await select({
      message: "What next?",
      choices: [
        { name: "Proceed with deletion", value: "proceed" },
        { name: "Remove items from this selection", value: "refine" },
        { name: "Cancel", value: "cancel" },
      ],
    });

    if (action === "proceed") return current;
    if (action === "cancel") return null;

    const keepIds = await checkbox({
      message:
        "Uncheck projects to REMOVE from the selection (space toggles, enter confirms what stays)",
      choices: current.map((p) => ({
        name: row(p, nowMs),
        value: p.id,
        checked: true,
      })),
      pageSize: 20,
      loop: false,
    });

    const keep = new Set(keepIds);
    current = current.filter((p) => keep.has(p.id));
  }
}
