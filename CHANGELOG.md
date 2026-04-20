# Changelog

All notable changes to this project are documented here. Format loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows [SemVer](https://semver.org/).

## [0.1.0] — 2026-04-20

First public release.

### Added

- **Six commands:** `login`, `whoami`, `logout`, `list`, `delete`, `history`.
- **Looping interactive menu** when invoked with no subcommand. Pick an action, see output, return to the menu. Exit via the menu or Ctrl-C (clean exit, status 130 — no stack trace).
- **`history` command** — browse past delete batches from the audit logs. Interactive looped select → detail view (per-project outcome, timing, failure reasons). Also works headless with `--json` to dump every batch for scripting.
- **Filters** shared by `list` and `delete`:
  - `--older-than <duration>` (e.g., `30d`, `6m`, `1y`). Projects with zero deployments always match.
  - `--name <glob>` (shell-style: `*`, `?`)
  - `--framework <name>` (exact match against Vercel's framework field)
  - `--no-repo` (projects without a connected git repo)
  - Multiple filters AND together.
- **Sorting:** `--sort name | last-deploy | updated` with `--reverse`. Default: `last-deploy` ascending (oldest first).
- **Delete safety rails:** interactive checklist → review screen with refine/cancel loop → numeric confirmation ("type N to confirm") → audit log written before the first DELETE → parallel deletes (concurrency default 5) → final log rewrite → summary.
- **Audit logs** at `<config-dir>/logs/deleted-<iso-timestamp>.json` recording every selected project and its final status (`deleted` / `already_gone` / `failed` / `pending`).
- **Auto-discovery of local `.vercel-bulk/`:** if present in `cwd` or any ancestor (Git-style walk-up), tokens + logs go there instead of `~/.vercel-bulk/`. Precedence: `VERCEL_BULK_CONFIG_DIR` env var > local dir > home.
- **Retry logic** in the HTTP client: 429 (`Retry-After`) and 5xx (exponential backoff, up to 3 retries). Auth errors halt the batch.
- **zod** validation on every Vercel API response, with detailed error messages showing which field(s) failed.
- **Masked token prompt** (`login` uses `@inquirer/prompts` password mode).
- **Mode 0600** on `config.json` (Unix).
- **`--json`** output on `list` for scripting.
- **`--dry-run`** on `delete` for previewing without API calls.
- **`--yes`** on `delete` for non-interactive scripts.

### Security

- Dependency audit: `pnpm audit --prod` → 0 known vulnerabilities.
- Supply chain: 4 direct prod deps (`@inquirer/prompts`, `commander`, `picocolors`, `zod`) with **no install hooks** anywhere in the transitive tree.
- No `eval()`, `new Function()`, `child_process`, or base64 decoding in production code.
- Token is never logged, never written to audit logs, and never appears in error output.

### Tech

- TypeScript with `moduleResolution: "Bundler"` and `noEmit: true`.
- Build via `vp pack` (tsdown) to a single bundled `dist/cli.mjs`.
- Tests via `vp test` (Vitest) — 81 tests across 19 files.
- Requires Node 18+.
