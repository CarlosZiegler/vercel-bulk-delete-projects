import { select } from "@inquirer/prompts";
import type { HistoryEntry } from "../core/history";
import { listHistory } from "../core/history";
import { colors, formatDate, humanizeAge } from "../ui/format";

export type HistoryOptions = {
  json?: boolean;
};

function summaryLine(e: HistoryEntry): string {
  const date = formatDate(new Date(e.log.startedAt));
  const user = e.log.user?.username ?? "unknown";
  const done = e.deletedCount + e.alreadyGoneCount;
  const parts = [colors.green(`${done} removed`)];
  if (e.failedCount > 0) parts.push(colors.red(`${e.failedCount} failed`));
  if (e.pendingCount > 0) parts.push(colors.yellow(`${e.pendingCount} pending`));
  return `${date}  ·  ${parts.join(", ")}   ${colors.dim(`(${user})`)}`;
}

function iconFor(status: string): string {
  switch (status) {
    case "deleted":
      return colors.green("✓");
    case "already_gone":
      return colors.dim("○");
    case "failed":
      return colors.red("✗");
    case "pending":
      return colors.yellow("…");
    default:
      return "?";
  }
}

function printDetail(e: HistoryEntry): void {
  const start = new Date(e.log.startedAt);
  const end = e.log.finishedAt ? new Date(e.log.finishedAt) : null;
  const durationMs = end ? end.getTime() - start.getTime() : null;
  const duration =
    durationMs === null
      ? colors.yellow("unfinished (process may have been killed)")
      : `${Math.max(1, Math.round(durationMs / 1000))}s`;

  console.log("");
  console.log(colors.bold(`Batch ${formatDate(start)}`) + colors.dim(`  (${duration})`));
  console.log(colors.dim(`User: ${e.log.user?.username ?? "unknown"}`));
  console.log(colors.dim(`File: ${e.fullPath}`));
  console.log("");

  for (const r of e.log.results) {
    const p = r.project;
    const age = humanizeAge(p.latestDeployment?.createdAt ?? null);
    const err = r.error ? colors.dim(`  (${r.error.code}: ${r.error.message})`) : "";
    const suffix = r.status === "already_gone" ? colors.dim("  (already gone)") : "";
    const line = `  ${iconFor(r.status)} ${p.name.padEnd(35)} ${(p.framework ?? "—").padEnd(12)} ${age}${suffix}${err}`;
    console.log(line);
  }

  const total = e.log.results.length;
  const summary = `  ${total} project${total === 1 ? "" : "s"}  ·  ${e.deletedCount} deleted, ${e.alreadyGoneCount} already gone, ${e.failedCount} failed${e.pendingCount > 0 ? `, ${e.pendingCount} pending` : ""}.`;
  console.log("");
  console.log(colors.dim(summary));
  console.log("");
}

export async function runHistory(opts: HistoryOptions): Promise<number> {
  const entries = await listHistory();

  if (entries.length === 0) {
    console.log(
      colors.dim(
        "No delete history yet. Audit logs are created automatically when you run `delete`.",
      ),
    );
    return 0;
  }

  if (opts.json) {
    const data = entries.map((e) => ({
      startedAt: e.log.startedAt,
      finishedAt: e.log.finishedAt,
      user: e.log.user,
      deleted: e.deletedCount,
      alreadyGone: e.alreadyGoneCount,
      failed: e.failedCount,
      pending: e.pendingCount,
      file: e.fullPath,
      results: e.log.results,
    }));
    console.log(JSON.stringify(data, null, 2));
    return 0;
  }

  const plural = entries.length === 1 ? "" : "es";
  console.log(colors.bold(`\nFound ${entries.length} delete batch${plural}.\n`));

  for (;;) {
    const choice = await select({
      message: "Select a batch to inspect",
      choices: [
        ...entries.map((e) => ({ name: summaryLine(e), value: e.filename })),
        { name: colors.dim("Exit history"), value: "__exit__" },
      ],
      pageSize: 15,
      loop: false,
    });

    if (choice === "__exit__") return 0;

    const entry = entries.find((e) => e.filename === choice);
    if (entry) printDetail(entry);
  }
}
