import { ApiError, ValidationError } from "../errors";
import { vercelFetch } from "./api";
import { ProjectListResponse, type Project } from "./schemas";

export async function listProjects(token: string): Promise<Project[]> {
  const all: Project[] = [];
  let until: string | number | null | undefined = undefined;
  const limit = 100;

  for (;;) {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (until !== undefined && until !== null) qs.set("until", String(until));
    const endpoint = `/v9/projects?${qs.toString()}`;
    const raw = await vercelFetch(token, "GET", endpoint);

    let parsed: ProjectListResponse;
    try {
      parsed = ProjectListResponse.parse(raw);
    } catch (cause) {
      throw new ValidationError(endpoint, cause);
    }

    all.push(...parsed.projects);
    const next = parsed.pagination?.next;
    if (next === null || next === undefined) break;
    until = next;
  }

  return all;
}

export type DeleteOutcome = "deleted" | "already_gone";

export async function deleteProject(token: string, idOrName: string): Promise<DeleteOutcome> {
  try {
    await vercelFetch(token, "DELETE", `/v9/projects/${encodeURIComponent(idOrName)}`);
    return "deleted";
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return "already_gone";
    throw e;
  }
}
