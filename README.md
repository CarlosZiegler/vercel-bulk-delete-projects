# vercel-bulk-delete-projects

Bulk operations on Vercel projects — list, filter, and safely delete many projects at once from your terminal.

Built because `vercel project rm` only deletes one project at a time, interactively, with no filtering. If you accumulate dozens of stale projects (old hackathons, preview branches, abandoned experiments), `vercel-bulk-delete-projects` lets you clean house in a single pass with proper safety rails.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Interactive mode](#interactive-mode)
- [Commands](#commands)
- [Filters](#filters)
- [Sorting](#sorting)
- [Safety rails](#safety-rails)
- [Config & token storage](#config--token-storage)
- [Security notes](#security-notes)
- [Architecture](#architecture)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Why this exists

Vercel still doesn't provide a way to delete multiple projects at once. `vercel project rm` handles one project at a time, interactively, with no filtering — so cleaning up a dozen old hackathons, preview branches, or abandoned experiments turns into a repetitive click-through chore. The pain is well documented on [community.vercel.com](https://community.vercel.com/):

- _Feature Request: Delete multiple projects at once_ (open since 2025-03)
- _Finally, a tool to bulk delete unwanted Vercel projects_ (2025-11)
- _Delete multiple projects and deployments on Vercel_ (2025-11)

`vercel-bulk-delete-projects` uses the official [Vercel REST API](https://vercel.com/docs/rest-api) and keeps your token completely local — nothing is stored or sent anywhere except Vercel itself. No telemetry, no cloud component, no account to create.

### Inspiration & prior art

The web-based [**Vercel Bulk Manager**](https://vercel-bulk-manager.vercel.app/) by [@Skandan-V](https://github.com/Skandan-V/Vercel-Bulk-Manager) (aka Hyperdyn) pioneered this exact workflow as a browser UI. `vercel-bulk-delete-projects` is a terminal-native take on the same idea — filters, sort, dry-run, audit logs, and an interactive menu — for people who live in the CLI and want something scriptable (and a token that never leaves their machine).

---

## Features

- **Looping interactive menu** when you run `vercel-bulk-delete-projects` with no subcommand — pick an action, see output, return to the menu, exit when you're done.
- **`list`** — print projects as a table, filter by age/name/framework, sort however you like, or dump JSON.
- **`delete`** — interactive checklist → review screen with refine/cancel → numeric confirmation → parallel deletes with live progress and audit log.
- **`history`** — browse past delete batches (date, totals, per-project outcomes). Audit logs are kept forever, one file per batch.
- **Filters:** `--older-than <duration>`, `--name <glob>`, `--framework <name>`, `--no-repo`.
- **Sort:** `--sort name|last-deploy|updated` plus `--reverse`.
- **Safety:** masked token prompt, file mode 0600, audit log written before any delete, `--dry-run`, auth-error halt on bulk.
- **Storage:** token in `~/.vercel-bulk/` by default, or auto-discover a local `.vercel-bulk/` in your project (Git-style walk-up).
- **Zero-install usage:** `npx vercel-bulk-delete-projects` once published to npm — no global install required.
- **Lean:** 4 direct production dependencies, ~1,200 lines of TypeScript, zero known CVEs, no install hooks.

---

## Install

### Zero-install via `npx` (recommended)

```bash
npx vercel-bulk-delete-projects              # opens the interactive menu
npx vercel-bulk-delete-projects login        # save a token
npx vercel-bulk-delete-projects list --older-than 6m
npx vercel-bulk-delete-projects delete --older-than 6m
```

When invoked via `npx`, the CLI's working directory is wherever you ran it from. Token + audit logs go to `~/.vercel-bulk/` (the default) unless you happen to be inside a project that has its own `.vercel-bulk/` folder.

### Install globally

```bash
npm i -g vercel-bulk-delete-projects
vercel-bulk-delete-projects --help
```

### Build from source

```bash
git clone <your-repo> vercel-bulk-delete-projects
cd vercel-bulk-delete-projects
vp install
vp run build
npm link            # exposes `vercel-bulk-delete-projects` on your PATH
```

> This project uses [Vite+](https://vite.plus) — install `vp` globally (`npm i -g vite-plus`) before running `vp install`. Under the hood Vite+ wraps pnpm, vitest, and tsdown.

### Dependencies

Just 4 production packages:

| Package             | What for                       |
| ------------------- | ------------------------------ |
| `@inquirer/prompts` | Interactive checkbox / select  |
| `commander`         | CLI argument parsing           |
| `picocolors`        | Terminal colors (no deps)      |
| `zod`               | Runtime validation of API data |

---

## Quick start

```bash
# 1. Save your Vercel access token
#    (create one at https://vercel.com/account/tokens)
vercel-bulk-delete-projects login

# 2. Sanity check
vercel-bulk-delete-projects whoami

# 3. See what's stale
vercel-bulk-delete-projects list --older-than 6m

# 4. Interactively delete stale projects
vercel-bulk-delete-projects delete --older-than 6m
```

---

## Interactive mode

Run `vercel-bulk-delete-projects` with no subcommand to open a looping menu:

```
vercel-bulk-delete-projects — bulk operations on Vercel projects

? What would you like to do?
❯ List projects
  Delete projects (interactive)
  History (browse past delete batches)
  Who am I?
  Login (save Vercel token)
  Logout (remove local token)
  Exit
```

Pick an action, see its output, then the menu reappears automatically below a separator so you can run the next thing. The session ends only when you pick **Exit** or press **Ctrl-C**.

```
(output from your last action)

───────────────────────────────────────────

? What would you like to do?
❯ List projects
  ...
```

Direct invocations are still one-shot — `vercel-bulk-delete-projects list` prints and exits, so scripts and pipes keep working.

---

## Commands

### `login`

Prompt for a Vercel access token (input is masked), validate it against `GET /v2/user`, then save to config.

```bash
vercel-bulk-delete-projects login
```

If `VERCEL_TOKEN` is already set in your shell, `login` warns you that the env var will override the file.

### `whoami`

Show the authenticated user and where the active token came from.

```bash
vercel-bulk-delete-projects whoami
#   User:   jane-doe (jane@example.com)
#   Source: /Users/jane/.vercel-bulk/config.json
```

### `logout`

Remove the locally stored token.

```bash
vercel-bulk-delete-projects logout          # confirms, removes config.json
vercel-bulk-delete-projects logout --yes    # skip confirmation (for scripts)
vercel-bulk-delete-projects logout --all    # also delete audit logs
```

### `history`

Browse past delete batches. Reads every audit log in `<config-dir>/logs/` and shows them in an interactive list.

```bash
vercel-bulk-delete-projects history
```

```
Found 3 delete batches.

? Select a batch to inspect
❯ 2026-04-21 10:15:23  ·  7 removed, 1 failed   (jane-doe)
  2026-04-20 16:02:48  ·  3 removed            (jane-doe)
  2026-04-20 14:33:12  ·  12 removed, 2 failed (jane-doe)
  Exit history
```

Pick a batch to see every project that was in it, with status icons (`✓` deleted, `○` already gone, `✗` failed, `…` pending). The command loops — after viewing one batch, you go back to the list until you pick Exit.

Use `--json` to dump all batches (including per-project results) to stdout:

```bash
vercel-bulk-delete-projects history --json > all-deletes.json
```

### `list`

Print all projects as a table (or JSON).

```bash
vercel-bulk-delete-projects list
vercel-bulk-delete-projects list --older-than 6m --sort name
vercel-bulk-delete-projects list --framework nextjs --json > projects.json
```

Output:

```
  Name                   Framework   Last Deploy    Repo
  ─────────────────────  ──────────  ─────────────  ─────────────────────
  my-hackathon-2024      nextjs      14 months ago  github.com/you/hack24
  weekend-experiment     vite        9 months ago   —
  portfolio-v2           nextjs      7 months ago   github.com/you/port2

  3 projects match (of 47 total).
```

### `delete`

Interactive bulk delete. The flow:

1. Fetches all projects (paginated).
2. Opens a checkbox picker — pre-selected to your filters (or empty if you passed no filters).
3. Shows a **review screen** listing every selected project with the action menu: `Proceed` / `Remove items` / `Cancel`. If you choose Remove, an unchecking sub-picker lets you drop items and loop back to review.
4. **Numeric confirmation**: type the batch size (e.g., `7`) to proceed.
5. Writes the audit log (pending state) to `~/.vercel-bulk/logs/`.
6. Deletes in parallel (default 5 concurrent), respecting Vercel rate limits (429 → retry after header; 5xx → exponential backoff).
7. Rewrites the audit log with final statuses.
8. Prints `N deleted, M failed. Log: ...`.

```bash
vercel-bulk-delete-projects delete --older-than 6m                    # pre-select stale
vercel-bulk-delete-projects delete --name "*-preview" --dry-run       # see what would happen
vercel-bulk-delete-projects delete --framework nextjs --yes           # scripts (skips confirm)
vercel-bulk-delete-projects delete --concurrency 3                    # gentler on rate limits
```

---

## Filters

Shared by `list` and `delete`. Multiple filters AND together.

| Flag                      | Matches                                                           | Example                               |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| `--older-than <duration>` | No deployment since. Projects with zero deployments always match. | `--older-than 6m`, `30d`, `1y`        |
| `--name <pattern>`        | Shell-style glob (`*`, `?`) against project name.                 | `--name "*-preview"`, `test-*`        |
| `--framework <name>`      | Exact match against Vercel's framework field.                     | `--framework nextjs`, `vite`, `nitro` |
| `--no-repo`               | Only projects without a connected git repo.                       | `--no-repo`                           |

Duration grammar: `<N>d` (days), `<N>m` (months — 30d), `<N>y` (years — 365d).

---

## Sorting

```bash
vercel-bulk-delete-projects list --sort name              # alphabetical (default asc)
vercel-bulk-delete-projects list --sort last-deploy       # oldest first (default)
vercel-bulk-delete-projects list --sort updated --reverse # most-recently updated first
```

| `--sort`      | Order                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| `name`        | Alphabetical by project name.                                             |
| `last-deploy` | By most recent deployment timestamp. **Default.** "Never deployed" first. |
| `updated`     | By Vercel's `updatedAt` project field.                                    |

`--reverse` flips whichever order you picked.

---

## Safety rails

Deletion is irreversible. `vercel-bulk-delete-projects delete` layers multiple protections:

1. **Empty default selection.** Running `delete` with no filter flags opens the picker with nothing pre-checked. You must explicitly choose.
2. **Filter pre-select.** Passing filter flags pre-checks matching projects so the common path ("delete everything older than 6m") is fast, but you can still uncheck any of them.
3. **Review screen.** After the picker, you see the full list of selected projects again, with three choices:
   - **Proceed** → numeric confirmation.
   - **Remove items** → a sub-picker with everything checked; uncheck to drop, then back to review.
   - **Cancel** → exit without any change.
4. **Numeric confirmation.** You type the exact batch count (e.g., `7` for 7 projects). Forces attention on the size.
5. **Audit log.** Before the first `DELETE` call, `vercel-bulk-delete-projects` writes `~/.vercel-bulk/logs/deleted-<ISO-timestamp>.json` listing every selected project with `status: "pending"`. After the batch, the file is rewritten with final `deleted` / `already_gone` / `failed` statuses. If the process is killed mid-batch, the pending log survives so you can see what was in-flight.
6. **Dry run.** Pass `--dry-run` to see exactly which projects would be deleted without any API calls.
7. **Auth halt.** If a `DELETE` returns `401`/`403`, the whole batch stops immediately (per-project `404` "already deleted" is treated as success and continues).

---

## Config & token storage

### Storage locations (resolved in order, first wins)

1. `--token <token>` flag (per-invocation override).
2. `VERCEL_TOKEN` env var.
3. `./.vercel-bulk/config.json` or nearest ancestor (Git-style walk-up, max 10 levels).
4. `~/.vercel-bulk/config.json` (default).

### Using a local config

`mkdir .vercel-bulk` in your project root, then `vercel-bulk-delete-projects login` — the token goes to `./.vercel-bulk/config.json` instead of your home directory. Handy for keeping project-specific tokens separate. The `.gitignore` already excludes `.vercel-bulk/` so the token never commits.

### Config file shape

```json
{
  "token": "vercel_pat_...",
  "user": { "id": "user_abc123", "username": "jane-doe" }
}
```

Mode `0600` on Unix (owner read/write only). Windows uses default NTFS permissions.

### Override the config directory entirely

Set `VERCEL_BULK_CONFIG_DIR=/some/path` to override both defaults. Mostly used by tests; useful if you want to keep configs out of `$HOME`.

---

## Security notes

- **Never commit `.vercel-bulk/`.** It's in `.gitignore`, but don't `git add -f` it.
- **`--token <value>` is visible in `ps` output.** On multi-user machines, prefer `VERCEL_TOKEN` env var or the saved config.
- **Shell history.** Avoid `VERCEL_TOKEN=xxx vercel-bulk-delete-projects ...` — the token will land in `~/.bash_history` / `~/.zsh_history`. Export it for the session (`export VERCEL_TOKEN=xxx`) or use the `login` command (masked input).
- **Audit logs contain project metadata only.** No token, no session data, no API response bodies — just which projects you selected and their delete outcomes.
- **Vercel API calls are HTTPS-only** (`https://api.vercel.com`), no fallback.
- **Dependency audit:** `pnpm audit --prod` → 0 vulnerabilities. No install hooks in any dep. No `eval` / `new Function()` / base64 decoding in production code.

---

## Architecture

```
┌────────────────────────────────────────────────┐
│  src/cli.ts + src/commands/*.ts                │   commander + @inquirer/prompts + picocolors
│  parses args, runs prompts, renders output     │
└──────────────────┬─────────────────────────────┘
                   │ calls
┌──────────────────▼─────────────────────────────┐
│  src/core/*.ts                                 │   zod + native fetch (no other deps)
│  API client, domain types, filters, sort        │   reusable by a future dashboard
└──────────────────┬─────────────────────────────┘
                   │ calls
┌──────────────────▼─────────────────────────────┐
│  Vercel REST API (https://api.vercel.com)      │
│  GET /v2/user, GET /v9/projects, DELETE /v9/projects/:id │
└────────────────────────────────────────────────┘
```

Layer separation is enforced by import direction: `core/` imports nothing from `commands/` or `ui/`, so the same core logic can later back a web dashboard without modification.

### Directory layout

```
src/
  cli.ts                    commander entry, global flags, default action → menu
  commands/
    login.ts                prompt for token, validate, save
    whoami.ts               show current user
    logout.ts               remove local config (+ optional logs)
    list.ts                 fetch → filter → sort → render table or JSON
    delete.ts               fetch → filter → sort → pick → review → confirm → delete
    menu.ts                 interactive select routing to the above
  core/
    api.ts                  fetch wrapper, 429 + 5xx retry with backoff
    user.ts                 getUser, validateToken
    projects.ts             listProjects (paginated), deleteProject
    filters.ts              applyFilters + parseDuration (pure)
    sort.ts                 sortProjects (pure)
    schemas.ts              zod schemas for API responses
    types.ts                FilterOptions, SortOptions, domain types
  config/
    paths.ts                configDir (env > local > home), auditLogPath
    token.ts                loadConfig, saveToken, resolveToken (async fs)
    audit-log.ts            writeAuditLog (async fs)
  ui/
    format.ts               humanizeAge, formatDate, colors re-export
    table.ts                renderProjectTable
    picker.ts               @inquirer checkbox wrapper
    confirm.ts              numeric confirm prompt
    review.ts               post-pick review loop (proceed/refine/cancel)
  errors.ts                 AuthError, RateLimitError, ApiError, ValidationError
test/
  core/                     unit tests (paths, token, audit-log, errors, schemas,
                            api, user, projects, filters, sort, format, table)
  commands/                 integration tests (login, whoami, logout, list, delete)
  fixtures/                 sample Vercel API responses
  smoke.test.ts             spawn built binary, assert --help works
```

---

## Development

```bash
vp install                         # install deps
vp exec tsx src/cli.ts --help      # run in dev (no build)
vp run dev -- --help               # same via npm script
vp test                            # full Vitest suite (81 tests across 19 files)
vp test --run test/core/filters.test.ts  # single file
vp run typecheck                   # tsc --noEmit
vp check                           # lint + format + types
vp run build                       # bundle to dist/cli.mjs via tsdown
node dist/cli.mjs --help           # smoke-test the bundle
```

### Key choices

- **TypeScript `moduleResolution: "Bundler"`** — no `.js` extensions on imports; bundler resolves at build time.
- **`noEmit: true`** — `tsc` only type-checks; `vp pack` (tsdown) emits the bundle.
- **`fs/promises`** everywhere that writes or reads config / audit logs — no event-loop blocking.
- **zod `.passthrough()`** on Vercel response schemas so upstream shape changes don't break the CLI; only required fields we actually use are validated.

---

## Troubleshooting

<details>
<summary><b>"Response shape from /v9/projects did not match expected schema"</b></summary>

The Vercel API returned a project with unexpected types. The CLI now shows which field(s) failed. If it's a required field we weren't expecting, file an issue with the zod error output.

</details>

<details>
<summary><b>"No Vercel token found. Run `vercel-bulk-delete-projects login` or set VERCEL_TOKEN"</b></summary>

No token resolvable from flag → env → local `.vercel-bulk/` → `~/.vercel-bulk/`. Run `vercel-bulk-delete-projects login` to save one.

</details>

<details>
<summary><b>Why are my deletes failing with 403?</b></summary>

Your Vercel token lacks permission on the project's team. The batch halts on the first 403 to avoid partial damage. Check the project's team scope vs. your token's team scope. Team-switching support is on the roadmap.

</details>

<details>
<summary><b>Rate-limit errors (429)</b></summary>

The CLI respects the `Retry-After` header automatically. If you're hitting frequently, reduce concurrency: `--concurrency 3` (or lower). The default is 5.

</details>

<details>
<summary><b>I deleted the wrong project. What now?</b></summary>

Vercel deletion is permanent — there's no undo. The audit log at `~/.vercel-bulk/logs/deleted-<timestamp>.json` records the project name, framework, and linked repo, so you can recreate the Vercel project and re-connect the git source. Redeployments recover.

</details>

---

## Roadmap

Planned, not yet built:

- **Team / scope support** — `--scope <team>` flag + `vercel-bulk-delete-projects switch` subcommand.
- **Export before delete** — snapshot project settings (env vars, domains, build config) to JSON before removal.
- **Bulk env var ops** — copy/delete env vars across many projects.
- **Web dashboard** — React + TanStack Start, importing `src/core/` directly as a library.

Open an issue if you want one of these prioritized, or a feature not listed.

---

## License

MIT (or whatever the repo owner chooses — update this line).
