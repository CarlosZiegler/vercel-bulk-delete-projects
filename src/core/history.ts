import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AuditLog } from "../config/audit-log";
import { logsDir } from "../config/paths";

export type HistoryEntry = {
  filename: string;
  fullPath: string;
  log: AuditLog;
  deletedCount: number;
  alreadyGoneCount: number;
  failedCount: number;
  pendingCount: number;
};

const LOG_PATTERN = /^deleted-.+\.json$/;

export async function listHistory(): Promise<HistoryEntry[]> {
  const dir = logsDir();

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const entries: HistoryEntry[] = [];
  for (const filename of files) {
    if (!LOG_PATTERN.test(filename)) continue;
    const fullPath = path.join(dir, filename);
    try {
      const contents = await fs.readFile(fullPath, "utf8");
      const log = JSON.parse(contents) as AuditLog;

      let deletedCount = 0;
      let alreadyGoneCount = 0;
      let failedCount = 0;
      let pendingCount = 0;
      for (const r of log.results) {
        if (r.status === "deleted") deletedCount += 1;
        else if (r.status === "already_gone") alreadyGoneCount += 1;
        else if (r.status === "failed") failedCount += 1;
        else if (r.status === "pending") pendingCount += 1;
      }

      entries.push({
        filename,
        fullPath,
        log,
        deletedCount,
        alreadyGoneCount,
        failedCount,
        pendingCount,
      });
    } catch {
      // skip corrupt / unreadable logs
    }
  }

  entries.sort((a, b) => b.log.startedAt.localeCompare(a.log.startedAt));
  return entries;
}
