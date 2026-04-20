import * as fs from "node:fs/promises";
import { configDir, configFilePath } from "./paths";

export type TokenSource = "flag" | "env" | "file";

export type UserInfo = {
  id: string;
  username: string;
};

export type Config = {
  token: string;
  user: UserInfo;
};

export async function loadConfig(): Promise<Config | null> {
  const p = configFilePath();
  try {
    const contents = await fs.readFile(p, "utf8");
    return JSON.parse(contents) as Config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function saveToken(token: string, user: UserInfo): Promise<void> {
  const dir = configDir();
  await fs.mkdir(dir, { recursive: true });
  const p = configFilePath();
  await fs.writeFile(p, JSON.stringify({ token, user }, null, 2));
  if (process.platform !== "win32") {
    await fs.chmod(p, 0o600);
  }
}

export async function resolveToken(): Promise<{ token: string; source: TokenSource } | null> {
  if (process.env.VERCEL_TOKEN) {
    return { token: process.env.VERCEL_TOKEN, source: "env" };
  }
  const cfg = await loadConfig();
  if (cfg?.token) {
    return { token: cfg.token, source: "file" };
  }
  return null;
}
