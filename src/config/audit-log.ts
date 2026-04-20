import * as fs from "node:fs/promises";
import { auditLogPath, logsDir } from "./paths";
import type { UserInfo } from "./token";

export type AuditStatus = "pending" | "deleted" | "already_gone" | "failed";

export type AuditedProject = {
  id: string;
  name: string;
  framework: string | null;
  link: { type: string; repo: string } | null;
  latestDeployment: { createdAt: number } | null;
  updatedAt: number;
};

export type AuditResult = {
  project: AuditedProject;
  status: AuditStatus;
  error?: { code: number; message: string };
};

export type AuditLog = {
  startedAt: string;
  finishedAt?: string;
  user: UserInfo;
  results: AuditResult[];
};

export async function writeAuditLog(log: AuditLog, at: Date = new Date()): Promise<string> {
  await fs.mkdir(logsDir(), { recursive: true });
  const p = auditLogPath(at);
  await fs.writeFile(p, JSON.stringify(log, null, 2));
  return p;
}
