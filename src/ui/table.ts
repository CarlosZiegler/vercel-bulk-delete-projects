import type { Project } from "../core/schemas";
import { colors, humanizeAge } from "./format";

const COLS = [
  { key: "name", label: "Name", width: 28 },
  { key: "framework", label: "Framework", width: 12 },
  { key: "lastDeploy", label: "Last Deploy", width: 16 },
  { key: "repo", label: "Repo", width: 30 },
] as const;

function pad(s: string, width: number): string {
  if (s.length >= width) return `${s.slice(0, width - 1)}…`;
  return s + " ".repeat(width - s.length);
}

export function renderProjectTable(projects: Project[], nowMs: number = Date.now()): string {
  if (projects.length === 0) return colors.dim("No projects to show.");

  const lines: string[] = [];
  const header = COLS.map((c) => pad(c.label, c.width)).join("  ");
  const rule = COLS.map((c) => "─".repeat(c.width)).join("  ");
  lines.push(colors.bold(header));
  lines.push(colors.dim(rule));

  for (const p of projects) {
    const last = p.latestDeployments?.[0]?.createdAt ?? null;
    const row = [
      pad(p.name, COLS[0].width),
      pad(p.framework ?? "—", COLS[1].width),
      pad(humanizeAge(last, nowMs), COLS[2].width),
      pad(p.link ? p.link.repo : "—", COLS[3].width),
    ].join("  ");
    lines.push(row);
  }

  return lines.join("\n");
}
