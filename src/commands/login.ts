import { password } from "@inquirer/prompts";
import { configFilePath } from "../config/paths";
import { saveToken } from "../config/token";
import { validateToken } from "../core/user";
import { AuthError } from "../errors";
import { colors } from "../ui/format";

export type LoginOptions = {
  token?: string;
};

export async function runLogin(opts: LoginOptions): Promise<number> {
  if (process.env.VERCEL_TOKEN) {
    console.log(
      colors.yellow("Note: VERCEL_TOKEN env var is set and will override the saved token."),
    );
  }

  const token =
    opts.token ??
    (await password({
      message: "Paste your Vercel access token (create one at https://vercel.com/account/tokens):",
      mask: "*",
    }));

  try {
    const user = await validateToken(token);
    await saveToken(token, { id: user.id, username: user.username });
    console.log(
      colors.green(`✔ Validated token for ${user.username}${user.email ? ` (${user.email})` : ""}`),
    );
    console.log(colors.green(`✔ Saved to ${configFilePath()}`));
    return 0;
  } catch (e) {
    if (e instanceof AuthError) {
      console.error(colors.red(`✗ Token rejected by Vercel (${e.status}). Nothing saved.`));
    } else {
      console.error(colors.red(`✗ ${(e as Error).message}`));
    }
    return 1;
  }
}
