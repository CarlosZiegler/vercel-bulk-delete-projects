import * as fs from "node:fs/promises";
import { confirm } from "@inquirer/prompts";
import { configFilePath, logsDir } from "../config/paths";
import { colors } from "../ui/format";

export type LogoutOptions = {
  yes?: boolean;
  all?: boolean;
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function runLogout(opts: LogoutOptions): Promise<number> {
  const cfg = configFilePath();
  const logs = logsDir();
  const hasConfig = await exists(cfg);
  const hasLogs = await exists(logs);

  if (!hasConfig && !(opts.all && hasLogs)) {
    console.log(colors.dim(`No token found at ${cfg}. Nothing to remove.`));
    return 0;
  }

  console.log(`About to remove:`);
  if (hasConfig) console.log(`  • ${cfg}`);
  if (opts.all && hasLogs) console.log(`  • ${logs} (all audit logs)`);

  if (!opts.yes) {
    const ok = await confirm({ message: "Proceed?", default: false });
    if (!ok) {
      console.log(colors.dim("Cancelled."));
      return 0;
    }
  }

  if (hasConfig) {
    await fs.rm(cfg, { force: true });
    console.log(colors.green(`✔ Removed ${cfg}`));
  }

  if (opts.all && hasLogs) {
    await fs.rm(logs, { recursive: true, force: true });
    console.log(colors.green(`✔ Removed audit logs at ${logs}`));
  }

  return 0;
}
