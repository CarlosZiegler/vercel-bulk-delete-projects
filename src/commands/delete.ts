import { writeAuditLog } from "../config/audit-log";
import type { AuditLog, AuditResult, AuditedProject } from "../config/audit-log";
import { loadConfig, resolveToken } from "../config/token";
import { applyFilters } from "../core/filters";
import { deleteProject, listProjects } from "../core/projects";
import type { Project } from "../core/schemas";
import { sortProjects } from "../core/sort";
import type { FilterOptions, SortOptions } from "../core/types";
import { ApiError, AuthError } from "../errors";
import { confirmNumeric } from "../ui/confirm";
import { colors } from "../ui/format";
import { pickProjects } from "../ui/picker";
import { reviewSelection } from "../ui/review";

export type DeleteOptions = FilterOptions &
  SortOptions & {
    token?: string;
    yes?: boolean;
    dryRun?: boolean;
    concurrency?: number;
  };

export async function runDelete(opts: DeleteOptions): Promise<number> {
  const resolved = opts.token
    ? { token: opts.token, source: "flag" as const }
    : await resolveToken();

  if (!resolved) {
    console.error(
      colors.red("No Vercel token found. Run `vercel-bulk login` or set VERCEL_TOKEN."),
    );
    return 1;
  }

  try {
    const allUnsorted = await listProjects(resolved.token);
    const all = sortProjects(allUnsorted, opts);
    const filtered = sortProjects(applyFilters(all, opts), opts);

    if (filtered.length === 0) {
      console.log(colors.yellow("No projects match the given filters. Nothing to do."));
      return 0;
    }

    const hasFilters =
      opts.olderThan !== undefined ||
      opts.namePattern !== undefined ||
      opts.framework !== undefined ||
      opts.noRepo === true;
    const preselected = hasFilters ? new Set(filtered.map((p) => p.id)) : new Set<string>();
    const picked = await pickProjects(all, preselected);
    if (picked.length === 0) {
      console.log(colors.dim("No projects selected. Exiting."));
      return 0;
    }

    let selected: Project[];
    if (opts.yes) {
      selected = picked;
    } else {
      const reviewed = await reviewSelection(picked);
      if (reviewed === null) {
        console.log(colors.dim("Cancelled."));
        return 0;
      }
      selected = reviewed;
    }

    if (opts.dryRun) {
      console.log(colors.cyan(`[dry-run] Would delete ${selected.length} project(s):`));
      for (const p of selected) console.log(`  • ${p.name}`);
      return 0;
    }

    if (!opts.yes) {
      const ok = await confirmNumeric(selected.length);
      if (!ok) {
        console.log(colors.dim("Cancelled."));
        return 0;
      }
    }

    const cfg = await loadConfig();
    const user = cfg?.user ?? { id: "unknown", username: "unknown" };
    const startedAt = new Date();
    const initialLog: AuditLog = {
      startedAt: startedAt.toISOString(),
      user,
      results: selected.map((p) => ({
        project: toAudited(p),
        status: "pending" as const,
      })),
    };
    const logPath = await writeAuditLog(initialLog, startedAt);
    console.log(colors.dim(`Writing audit log to ${logPath}`));

    try {
      const results = await runDeletes(resolved.token, selected, opts.concurrency ?? 5);
      const finalLog: AuditLog = {
        ...initialLog,
        finishedAt: new Date().toISOString(),
        results,
      };
      await writeAuditLog(finalLog, startedAt);

      const deleted = results.filter(
        (r) => r.status === "deleted" || r.status === "already_gone",
      ).length;
      const failed = results.filter((r) => r.status === "failed").length;
      console.log(
        `\nDone: ${colors.green(String(deleted))} deleted, ${
          failed > 0 ? colors.red(String(failed)) : "0"
        } failed.`,
      );
      console.log(colors.dim(`Log: ${logPath}`));
      return 0;
    } catch (e) {
      if (e instanceof AuthError) {
        console.error(
          colors.red(`✗ Auth error during batch: ${e.message}. Run \`vercel-bulk login\`.`),
        );
        return 1;
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof AuthError) {
      console.error(colors.red(`✗ Auth error: ${e.message}. Run \`vercel-bulk login\`.`));
      return 1;
    }
    console.error(colors.red(`✗ ${(e as Error).message}`));
    return 1;
  }
}

function toAudited(p: Project): AuditedProject {
  const first = p.latestDeployments?.[0];
  const createdAt = first?.createdAt;
  return {
    id: p.id,
    name: p.name,
    framework: p.framework,
    link: p.link ?? null,
    latestDeployment: createdAt !== undefined ? { createdAt } : null,
    updatedAt: p.updatedAt,
  };
}

async function runDeletes(
  token: string,
  projects: Project[],
  concurrency: number,
): Promise<AuditResult[]> {
  const results: AuditResult[] = Array.from({ length: projects.length });
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, projects.length) }, async () => {
    for (;;) {
      const idx = next;
      next += 1;
      if (idx >= projects.length) return;
      const p = projects[idx];
      if (!p) return;
      const audited = toAudited(p);
      try {
        const outcome = await deleteProject(token, p.id);
        results[idx] = { project: audited, status: outcome };
        console.log(
          `  ${colors.green("✓")} ${p.name}${
            outcome === "already_gone" ? colors.dim(" (already gone)") : ""
          }`,
        );
      } catch (e) {
        if (e instanceof AuthError) throw e;
        const err =
          e instanceof ApiError
            ? {
                code: e.status,
                message:
                  (e.body as { error?: { message?: string } } | null | undefined)?.error?.message ??
                  e.message,
              }
            : { code: 0, message: (e as Error).message };
        results[idx] = { project: audited, status: "failed", error: err };
        console.log(
          `  ${colors.red("✗")} ${p.name} ${colors.dim(`(${err.code}: ${err.message})`)}`,
        );
      }
    }
  });
  await Promise.all(workers);
  return results;
}
