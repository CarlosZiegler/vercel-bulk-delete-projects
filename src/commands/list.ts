import { resolveToken } from "../config/token";
import { applyFilters } from "../core/filters";
import { listProjects } from "../core/projects";
import { sortProjects } from "../core/sort";
import type { FilterOptions, SortOptions } from "../core/types";
import { colors } from "../ui/format";
import { renderProjectTable } from "../ui/table";

export type ListOptions = FilterOptions &
  SortOptions & {
    token?: string;
    json?: boolean;
  };

export async function runList(opts: ListOptions): Promise<number> {
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
    const all = await listProjects(resolved.token);
    const filtered = sortProjects(applyFilters(all, opts), opts);

    if (opts.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return 0;
    }

    console.log(renderProjectTable(filtered));
    const noun = filtered.length === 1 ? "project" : "projects";
    const verb = filtered.length === 1 ? "matches" : "match";
    console.log(colors.dim(`\n${filtered.length} ${noun} ${verb} (of ${all.length} total).`));
    return 0;
  } catch (e) {
    console.error(colors.red(`✗ ${(e as Error).message}`));
    return 1;
  }
}
