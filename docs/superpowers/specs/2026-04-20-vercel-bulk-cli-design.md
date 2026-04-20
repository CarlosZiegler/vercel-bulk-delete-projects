# vercel-bulk CLI — Design Spec

- **Date:** 2026-04-20
- **Author:** Carlos Ziegler (brainstormed with Claude)
- **Status:** Draft — awaiting approval before implementation planning

## 1. Problem

Vercel users accumulate dead projects over time: old hackathons, preview branches that never got cleaned up, abandoned experiments, renamed projects. The official `vercel` CLI can delete them — but only **one at a time**, interactively, with no filtering (by age, by name pattern, by framework). For someone with dozens or hundreds of stale projects, this is impractical.

**Primary use case:** clean up a personal Vercel account by deleting many stale projects in one pass, safely.

## 2. Goals

- **Bulk delete** of Vercel projects, filtered by meaningful criteria (no deployment since N months, name pattern, framework).
- **Safe by default:** interactive checklist + numeric confirmation + audit log before any deletion.
- **Terminal-first UX** modeled after `shadcn-ui/ui/packages/shadcn`: interactive, discoverable, no flags needed for the happy path.
- **Clean architecture** — a pure `core/` layer (REST API + domain logic) that a future web dashboard can import verbatim.

## 3. Non-goals (v1)

- Team / scope switching (personal account only in v1)
- Bulk env var, domain, or deployment operations
- Export-before-delete (project-settings backup to JSON before deletion)
- System-keychain token storage
- Web dashboard / TanStack Start integration (designed-for, not built)
- Undo / restore (impossible — Vercel deletion is permanent)

## 4. User experience

### 4.1 Commands (v1)

Four commands. Each shown as the happy-path interaction.

#### `vercel-bulk login`

```
$ vercel-bulk login
? Paste your Vercel access token (create one at https://vercel.com/account/tokens):
  › ****************************
✔ Validated token for carlos (carlos.ziegler@zietec.io)
✔ Saved to ~/.vercel-bulk/config.json
```

- Prompt uses masked input (`@inquirer/prompts` password type) to keep token out of shell history.
- Validates by calling `GET /v2/user` before persisting. Invalid token → error, nothing written.
- If `VERCEL_TOKEN` env var is already set, warns that env var will override the stored file.

#### `vercel-bulk whoami`

```
$ vercel-bulk whoami
  User:   carlos (carlos.ziegler@zietec.io)
  Plan:   Hobby
  Source: ~/.vercel-bulk/config.json
```

Sanity check. Reads token, calls `/v2/user`, renders.

#### `vercel-bulk list`

```
$ vercel-bulk list --older-than 6m

  Name                   Framework   Last Deploy    Repo
  ─────────────────────  ──────────  ─────────────  ─────────────────────
  my-hackathon-2024      Next.js     14 months ago  github.com/c/hack24
  weekend-experiment     Vite        9 months ago   —
  portfolio-v2           Next.js     7 months ago   github.com/c/port2
  ... 12 more

  15 projects match (of 47 total)
```

Flags:

- `--older-than <duration>` — `30d`, `6m`, `1y` — no deployment since. Projects with **zero deployments** match any `--older-than` value (they are effectively "infinitely old").
- `--name <pattern>` — glob: `*-preview`, `test-*`.
- `--framework <name>` — `next`, `vite`, `remix`, etc. (matches Vercel's framework field).
- `--no-repo` — only projects with no connected git repo.
- `--json` — machine-readable output.

Multiple filters are AND'd. No filters = list all.

#### `vercel-bulk delete`

```
$ vercel-bulk delete --older-than 6m

Fetching projects... ✓ (47 projects, 15 match filters)

? Select projects to delete (space to toggle, a to toggle all, enter to confirm)
  ◯ my-hackathon-2024      Next.js   14 months ago
❯ ◉ weekend-experiment     Vite      9 months ago
  ◉ portfolio-v2           Next.js   7 months ago
  ...

You selected 7 projects:
  • weekend-experiment       (last deploy: 9 months ago)
  • portfolio-v2             (last deploy: 7 months ago)
  • ...

? Type "7" to confirm deletion: › 7

Writing audit log to ~/.vercel-bulk/logs/deleted-2026-04-20T14-33-12Z.json ✓
Deleting 7 projects... [████████████████░░░] 5/7
  ✓ weekend-experiment
  ✓ portfolio-v2
  ✗ dead-app (403: not authorized — skipped)
  ...

Done: 6 deleted, 1 failed. Log: ~/.vercel-bulk/logs/deleted-2026-04-20T14-33-12Z.json
```

Flags:

- All filter flags from `list` (pre-select matches in the picker).
- `--dry-run` — show what would happen, no API calls.
- `--yes` — skip the numeric confirm prompt (for scripting; audit log still written).
- `--concurrency <n>` — default 5 parallel deletes, respects Vercel rate limits.

### 4.2 Global flags

Every command supports:

- `--token <token>` — override stored/env token for this invocation.
- `--json` — machine-readable output (errors as JSON too).
- `--help`, `--version`.

### 4.3 Safety rails (the "paranoia" level)

Deletion is irreversible, so:

1. **Interactive checklist** — nothing happens without explicit selection.
2. **Numeric confirmation** — "type `7` to confirm" forces attention on batch size.
3. **Audit log** — every delete batch writes `~/.vercel-bulk/logs/deleted-<iso-timestamp>.json` containing, for each selected project: `id`, `name`, `framework`, `link`, `latestDeployment.createdAt`, `updatedAt`. Written **before** the first DELETE call.
4. **Per-project failures don't halt the batch** — recorded in the log with the error body, batch continues.
5. **`--dry-run`** available on `delete` for "show me what this would do."

## 5. Architecture

### 5.1 Layering

```
┌────────────────────────────────────────────────┐
│  CLI shell (src/cli.ts + src/commands/*.ts)    │  ← commander, @inquirer/prompts, ora, picocolors
│  Parses args, runs prompts, renders output.    │
└──────────────────┬─────────────────────────────┘
                   │ calls
┌──────────────────▼─────────────────────────────┐
│  Core (src/core/*.ts)                          │  ← pure; only deps are zod + native fetch
│  Vercel API client, filters, domain types.    │     reusable by future dashboard
└──────────────────┬─────────────────────────────┘
                   │ calls
┌──────────────────▼─────────────────────────────┐
│  Vercel REST API (https://api.vercel.com)      │
└────────────────────────────────────────────────┘
```

**Key invariant:** `src/core/` imports only `zod` and uses only `fetch`. No `commander`, no `chalk`, no prompt libraries. This makes the future web dashboard possible — its server functions would import `core/` directly.

### 5.2 API endpoints used

Exactly three endpoints. Docs: https://vercel.com/docs/rest-api/reference/endpoints

| Endpoint                             | Purpose                        | Used by           |
| ------------------------------------ | ------------------------------ | ----------------- |
| `GET /v2/user`                       | Validate token, read user info | `login`, `whoami` |
| `GET /v9/projects?limit=100&until=…` | List projects (paginated)      | `list`, `delete`  |
| `DELETE /v9/projects/:idOrName`      | Delete one project             | `delete`          |

**Not used:** the `vercel` npm package is removed. We speak HTTP directly via `fetch`. Rationale: bulk delete requires parallel calls, parseable errors, and rate-limit headers — all things an HTTP client gives us that shelling out does not.

### 5.3 Auth

- Primary source: `~/.vercel-bulk/config.json` (file mode `0600` on Unix; default NTFS perms on Windows — documented caveat, not a bug).
- Override: `VERCEL_TOKEN` env var (takes precedence over file).
- Override: `--token <token>` flag (takes precedence over env var).
- No OAuth device flow (Vercel API does not offer one for public token creation).
- **No-token behavior:** `login`, `--help`, and `--version` work without a token. Every other command, if no token is resolvable from flag/env/file, prints `No Vercel token found. Run \`vercel-bulk login\` or set VERCEL_TOKEN.`and exits with code`1`.

Config file shape:

```json
{ "token": "vercel_...", "user": { "id": "...", "username": "..." } }
```

### 5.4 Data flow for `delete`

```
1. Load token (flag > env > config file).
2. Fetch all projects: loop GET /v9/projects with pagination until empty response.
3. Apply filters (pure function in core/filters.ts).
4. Render checkbox picker (commands/delete.ts). User selects subset.
5. Render confirmation screen + numeric prompt.
6. Write audit log to ~/.vercel-bulk/logs/deleted-<iso-ts>.json.
7. For each selected project, with concurrency=5:
     DELETE /v9/projects/:id
     Success (204) / Already-gone (404) → mark success.
     Rate-limited (429) → respect Retry-After, retry.
     Server error (5xx) → exponential backoff, max 3 attempts.
     Auth error (401/403) → halt immediately.
     Other error → record in audit log, continue batch.
8. Render summary.
```

**Why `latestDeployments` is cheap:** Vercel's `/v9/projects` list response includes `latestDeployments[0].createdAt`. No per-project calls needed for the "older than" filter. 47 projects = 1 API round-trip.

### 5.5 Error handling

Typed errors in `src/errors.ts`:

- `AuthError` (401/403) → halt immediately, suggest `vercel-bulk login`.
- `RateLimitError` (429) → retry using `Retry-After` header.
- `ApiError` (other 4xx/5xx) → retry 5xx up to 3× with backoff; 4xx bubbles up.
- `ValidationError` (zod parse failure) → indicates API shape change; show endpoint + offending field.

Network errors (fetch throws) → treated as 5xx → retry with backoff.

### 5.6 Config & state

| Path                                        | Purpose                    | Format                    |
| ------------------------------------------- | -------------------------- | ------------------------- |
| `~/.vercel-bulk/config.json`                | Auth + user info           | JSON, mode `0600` on Unix |
| `~/.vercel-bulk/logs/deleted-<iso-ts>.json` | Audit log per delete batch | JSON (see shape below)    |

Audit log shape:

```json
{
  "startedAt": "2026-04-20T14:33:12.000Z",
  "finishedAt": "2026-04-20T14:33:19.000Z",
  "user": { "id": "...", "username": "carlos" },
  "results": [
    {
      "project": {
        "id": "prj_...",
        "name": "weekend-experiment",
        "framework": "vite",
        "link": null,
        "latestDeployment": { "createdAt": 1720000000000 },
        "updatedAt": 1720000000000
      },
      "status": "deleted"
    },
    {
      "project": { "id": "prj_...", "name": "dead-app", "...": "..." },
      "status": "failed",
      "error": { "code": 403, "message": "not authorized" }
    }
  ]
}
```

Every project the user selected appears in `results` exactly once, with `status` ∈ `{deleted, already_gone, failed, pending}`. The log is written **before** the first DELETE call with all entries `status: "pending"`, ensuring the audit trail exists even if the process is interrupted. After the batch completes, the final log is written over the pending one with real statuses.

## 6. Project structure

```
vercel-bulk/
├── src/
│   ├── cli.ts                      ← bin entry, commander setup, global flags
│   ├── commands/
│   │   ├── login.ts
│   │   ├── whoami.ts
│   │   ├── list.ts
│   │   └── delete.ts
│   ├── core/                       ← no CLI deps; reusable by future dashboard
│   │   ├── api.ts                  ← fetch wrapper, retry/backoff, 429 handling
│   │   ├── projects.ts             ← listProjects(filters), deleteProject(id)
│   │   ├── user.ts                 ← getUser(), validateToken()
│   │   ├── filters.ts              ← pure: applyFilters(projects, filters)
│   │   ├── schemas.ts              ← zod schemas for API responses
│   │   └── types.ts                ← domain types
│   ├── ui/
│   │   ├── table.ts                ← render project table
│   │   ├── picker.ts               ← checkbox wrapper
│   │   ├── confirm.ts              ← numeric confirm prompt
│   │   └── format.ts               ← picocolors + duration humanizer
│   ├── config/
│   │   ├── paths.ts                ← ~/.vercel-bulk/* path resolvers
│   │   ├── token.ts                ← load/save token
│   │   └── audit-log.ts            ← write deleted-<ts>.json
│   └── errors.ts
├── test/
│   ├── core/
│   ├── commands/
│   └── fixtures/
│       └── projects.json           ← sample Vercel API responses
├── package.json                    ← "bin": { "vercel-bulk": "./dist/cli.js" }
├── tsconfig.json
└── vite.config.ts / tsdown.config.ts  ← bundler config (decided during impl)
```

### 6.1 Files to delete from the current repo

`index.html`, `public/`, `src/main.ts`, `src/counter.ts`, `src/style.css`, `src/assets/`.

### 6.2 Files to modify

- `package.json`:
  - Remove: `vercel` (unused after REST switch).
  - Add: `commander`, `@inquirer/prompts`, `picocolors`, `ora`, `zod`.
  - Add: `"bin": { "vercel-bulk": "./dist/cli.js" }`.
  - Add: `"files": ["dist"]` for npm publish later.
- `vite.config.ts`: either replaced with `tsdown.config.ts` for library/CLI bundling, or reconfigured for library mode. Decided during implementation.

## 7. Tech stack

Modeled after `shadcn-ui/ui/packages/shadcn`, with small swaps for leaner deps:

| Concern         | Choice                       | Why                                                  |
| --------------- | ---------------------------- | ---------------------------------------------------- |
| Command parsing | `commander`                  | Mature, familiar, matches shadcn                     |
| Prompts         | `@inquirer/prompts`          | Strong types, checkbox + password + confirm built in |
| Colors          | `picocolors`                 | ~10× smaller than chalk, zero deps, drop-in          |
| Spinners        | `ora`                        | Standard; shadcn uses it                             |
| Validation      | `zod`                        | Runtime parsing of API responses                     |
| HTTP            | native `fetch`               | Node 18+; zero deps                                  |
| Dev             | `vp dev` (Vite+)             | Already in project                                   |
| Bundle          | `vp pack` / tsdown           | Already in project via Vite+                         |
| Tests           | `vp test` (Vitest via Vite+) | Already in project                                   |

Tools installed via `vp install` (project uses pnpm under the hood; we do not call pnpm directly per Vite+ conventions).

## 8. Testing strategy

Three layers, matching the three code layers.

### 8.1 Unit tests — `src/core/` (majority of suite)

- `filters.test.ts` — empty filter returns all; unmatched filter returns none; multiple filters AND'd.
- `schemas.test.ts` — real API response fixtures parse successfully; malformed fixtures throw.
- `api.test.ts` — retry logic: 429 + `Retry-After` waits and retries; 3× 5xx backs off then succeeds; 401 throws `AuthError` immediately.

### 8.2 Integration tests — `src/commands/`

Mock `fetch` + mock `@inquirer/prompts`; use `fs.mkdtempSync` for isolated config/log paths.

- `list.test.ts` — mocked fetch → expected table output (snapshot on text, not ANSI colors).
- `delete.test.ts` — mocked fetch + prompt; assert correct `DELETE` calls, audit log content, one-failure-does-not-halt behavior.
- `login.test.ts` — mocked fetch (user endpoint) + masked prompt; assert config file written with mode `0600`.

### 8.3 Smoke test (1 test)

Build, spawn `vercel-bulk --help` as a subprocess, assert non-zero exit not returned and all 4 commands listed.

### 8.4 Coverage target

- `src/core/`: ~80% (pure, high leverage).
- `src/commands/`, `src/ui/`: happy-path integration only.
- No coverage chase on error-branch CLI glue.

### 8.5 What is explicitly NOT tested

- The real Vercel API (no live API calls; zod schemas are the contract).
- Terminal pixel rendering (snapshot plain text, not colors/cursor).

## 9. Risks

| Risk                           | Mitigation                                                            |
| ------------------------------ | --------------------------------------------------------------------- |
| Vercel API shape changes       | zod schemas throw loud `ValidationError` naming the endpoint + field  |
| Bulk-delete rate limiting      | Default concurrency 5; respect `Retry-After`; expose `--concurrency`  |
| Wrong account selected         | `login` and `whoami` prominently show user + email                    |
| Partial delete failures        | Audit log records every outcome; final summary: `N deleted, M failed` |
| Token leaked via shell history | Masked password prompt in `login`                                     |

## 10. Dependencies

### Add

- `commander`
- `@inquirer/prompts`
- `picocolors`
- `ora`
- `zod`

### Remove

- `vercel` (unused after REST switch)
- Vite web-starter source files (listed in §6.1)

### Keep

- `vite-plus` (provides `vp test`, `vp pack`, `vp dev`)
- `typescript`

## 11. Future work (post-v1, separate specs)

Ordered roughly by anticipated value:

1. **Team / scope support** — `--scope <team>`, `vercel-bulk switch`.
2. **Export-before-delete** — archive project settings to JSON before deletion.
3. **TanStack Start dashboard** — imports `src/core/` verbatim; adds server functions + React UI.
4. **Bulk env var ops** — copy/delete env vars across many projects.
5. **System-keychain token storage** — optional, behind a flag.

## 12. Open questions resolved during brainstorming

- **Use REST API directly, not the `vercel` CLI.** → §5.2.
- **Personal account only in v1, no team support.** → §3.
- **Interactive checklist UX, not flag-driven.** → §4.1.
- **Moderate safety rails + audit log.** → §4.3.
- **Token in config file; `VERCEL_TOKEN` overrides.** → §5.3.
- **CLI first, dashboard later as a separate project reusing `core/`.** → §5.1.
