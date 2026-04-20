import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const DIR_NAME = ".vercel-bulk";
const MAX_WALK_UP = 10;

function findLocal(startCwd: string = process.cwd()): string | null {
  let cur = startCwd;
  for (let i = 0; i < MAX_WALK_UP; i++) {
    const candidate = path.join(cur, DIR_NAME);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

export function configDir(): string {
  const fromEnv = process.env.VERCEL_BULK_CONFIG_DIR;
  if (fromEnv) return fromEnv;
  const local = findLocal();
  if (local) return local;
  return path.join(os.homedir(), DIR_NAME);
}

export function configFilePath(): string {
  return path.join(configDir(), "config.json");
}

export function logsDir(): string {
  return path.join(configDir(), "logs");
}

export function auditLogPath(at: Date = new Date()): string {
  const ts = at
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "Z");
  return path.join(logsDir(), `deleted-${ts}.json`);
}
