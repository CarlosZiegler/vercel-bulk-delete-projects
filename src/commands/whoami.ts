import { configFilePath } from "../config/paths";
import { resolveToken } from "../config/token";
import { getUser } from "../core/user";
import { colors } from "../ui/format";

export type WhoamiOptions = {
  token?: string;
};

export async function runWhoami(opts: WhoamiOptions): Promise<number> {
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
    const user = await getUser(resolved.token);
    console.log(`  User:   ${user.username}${user.email ? ` (${user.email})` : ""}`);
    console.log(`  Source: ${resolved.source === "file" ? configFilePath() : resolved.source}`);
    return 0;
  } catch (e) {
    console.error(colors.red(`✗ ${(e as Error).message}`));
    return 1;
  }
}
