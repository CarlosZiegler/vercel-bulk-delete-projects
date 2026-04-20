import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { deleteProject, listProjects, type DeleteOutcome } from "../../src/core/projects";
import { ValidationError } from "../../src/errors";

describe("core/projects.listProjects", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a single page when pagination.next is null", async () => {
    vi.stubGlobal(
      "fetch",
      async (_url: string) =>
        new Response(
          JSON.stringify({
            projects: [{ id: "p1", name: "a", framework: null, link: null, updatedAt: 0 }],
            pagination: { count: 1, next: null },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    const all = await listProjects("t");
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe("p1");
  });

  it("paginates using pagination.next until null", async () => {
    const pages = [
      {
        projects: [{ id: "p1", name: "a", framework: null, link: null, updatedAt: 0 }],
        pagination: { count: 1, next: 123 },
      },
      {
        projects: [{ id: "p2", name: "b", framework: null, link: null, updatedAt: 0 }],
        pagination: { count: 1, next: null },
      },
    ];
    let call = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      const page = pages[call]!;
      call += 1;
      if (call === 2) expect(url).toContain("until=123");
      return new Response(JSON.stringify(page), { status: 200 });
    });

    const all = await listProjects("t");
    expect(all.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("throws ValidationError on bad shape", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ wrong: true }), { status: 200 }),
    );
    await expect(listProjects("t")).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("core/projects.deleteProject", () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns "deleted" on 204', async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 204 }));
    const outcome: DeleteOutcome = await deleteProject("t", "p1");
    expect(outcome).toBe("deleted");
  });

  it('returns "already_gone" on 404', async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({}), { status: 404 }));
    const outcome = await deleteProject("t", "p1");
    expect(outcome).toBe("already_gone");
  });

  it("propagates AuthError on 403", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 403 }));
    await expect(deleteProject("t", "p1")).rejects.toMatchObject({ name: "AuthError" });
  });
});
