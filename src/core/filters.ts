import type { FilterOptions } from "./types";
import type { Project } from "./schemas";

const DURATION_RE = /^(\d+)([dmy])$/;

export function parseDuration(input: string): number {
  const match = DURATION_RE.exec(input);
  if (!match) throw new Error(`Invalid duration: "${input}". Use e.g. 30d, 6m, 1y.`);
  const n = Number(match[1]);
  const unit = match[2];
  const day = 24 * 3600 * 1000;
  switch (unit) {
    case "d":
      return n * day;
    case "m":
      return n * 30 * day;
    case "y":
      return n * 365 * day;
    default:
      throw new Error(`Unreachable: unit ${unit}`);
  }
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

export function applyFilters(
  projects: Project[],
  opts: FilterOptions,
  nowMs: number = Date.now(),
): Project[] {
  return projects.filter((p) => {
    if (opts.namePattern !== undefined) {
      const re = globToRegex(opts.namePattern);
      if (!re.test(p.name)) return false;
    }
    if (opts.framework !== undefined) {
      if (p.framework !== opts.framework) return false;
    }
    if (opts.noRepo) {
      if (p.link !== null) return false;
    }
    if (opts.olderThan !== undefined) {
      const cutoff = nowMs - parseDuration(opts.olderThan);
      const latest = p.latestDeployments?.[0]?.createdAt;
      if (latest !== undefined && latest > cutoff) return false;
    }
    return true;
  });
}
