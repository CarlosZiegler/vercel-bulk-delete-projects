import pc from "picocolors";

export const colors = pc;

const DAY = 86400000;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function humanizeAge(
  createdAtMs: number | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (createdAtMs === null || createdAtMs === undefined) return "never";
  const diff = nowMs - createdAtMs;
  if (diff < 0) return "in the future";
  if (diff >= YEAR) {
    const years = Math.floor(diff / YEAR);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }
  if (diff >= MONTH) {
    const months = Math.floor(diff / MONTH);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const days = Math.max(1, Math.floor(diff / DAY));
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
