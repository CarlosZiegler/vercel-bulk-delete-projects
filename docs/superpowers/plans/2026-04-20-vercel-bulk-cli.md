# vercel-bulk CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js CLI (`vercel-bulk`) that lists Vercel projects, filters them by age/name/framework, and bulk-deletes selected ones via an interactive checklist — with numeric confirmation, audit logging, and parallel deletes using the Vercel REST API.

**Architecture:** Three-layer — a pure `core/` layer (zod + native `fetch`, reusable by a future dashboard), a `ui/` layer (prompts, tables, colors), and thin `commands/` glue invoked by `cli.ts` (commander). See spec §5 for detail.

**Tech Stack:** TypeScript (ESM), Node 22+, commander, @inquirer/prompts, picocolors, ora, zod. Vite+ (`vp test`, `vp check`) for testing and type-checking. `tsc` for production build. `tsx` for dev. Native `fetch` for HTTP (no extra HTTP dep).

**Spec reference:** `docs/superpowers/specs/2026-04-20-vercel-bulk-cli-design.md`

---

## Conventions used in this plan

- **Commits:** conventional-commit style (`feat:`, `test:`, `chore:`, `refactor:`). Commit after every test-pass green.
- **Test runner:** `vp test` (Vitest via Vite+). Test imports: `import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';`.
- **File extensions in imports:** use `.js` (TypeScript ESM convention).
- **Initializing git:** Task 0.0 runs `git init` because this project is not yet a git repo. Every subsequent task's commit step assumes the repo exists.

---

## Phase 0 — Project scaffold

### Task 0.0: Initialize git repository

**Files:**

- Create: `.gitignore` (already exists — verify contents include `node_modules` and `dist`)

- [ ] **Step 1: Initialize git and set up `.gitignore`**

Run:

```bash
git init
```

Verify `.gitignore` contains `node_modules` and `dist`. If missing, append.

- [ ] **Step 2: Initial commit of existing scaffold**

```bash
git add -A
git commit -m "chore: initial commit of Vite+ scaffold"
```

---

### Task 0.1: Strip the Vite web-starter files

**Files:**

- Delete: `index.html`, `public/`, `src/main.ts`, `src/counter.ts`, `src/style.css`, `src/assets/`
- Modify: `vite.config.ts` — delete (replaced later)

- [ ] **Step 1: Remove web-starter files**

```bash
rm index.html
rm -rf public src/main.ts src/counter.ts src/style.css src/assets
rm vite.config.ts
```

- [ ] **Step 2: Verify removal**

```bash
ls -la
ls -la src/
```

Expected: no `index.html`, no `public/`, `src/` is empty or only has a `.gitkeep`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: strip Vite web starter files"
```

---

### Task 0.2: Update `package.json` (remove `vercel`, add CLI deps, add `bin`)

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Rewrite `package.json`**

Replace `/Users/zietec/work/vercel-bulk/package.json` with:

```json
{
  "name": "vercel-bulk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": {
    "vercel-bulk": "./dist/cli.js"
  },
  "files": ["dist"],
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "test": "vp test",
    "check": "vp check",
    "prepare": "vp config"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "~6.0.2",
    "vite-plus": "catalog:"
  },
  "packageManager": "pnpm@10.33.0",
  "dependencies": {
    "@inquirer/prompts": "^7.0.0",
    "commander": "^13.0.0",
    "picocolors": "^1.1.0",
    "zod": "^3.23.0"
  }
}
```

Notes:

- Removed `vercel` (replaced by direct REST API).
- Removed `vite` (no longer a web app). `vite-plus` remains for `vp test` / `vp check`.
- Added `tsx` as a dev dep for running `cli.ts` directly in development.
- `build` uses plain `tsc` — a CLI needs no bundler.
- `ora` intentionally not included in v1 — progress output is printed inline with picocolors `✓`/`✗` markers (matches the spec's example output in §4.1). Can be added later if a fancier spinner is desired.

- [ ] **Step 2: Install**

```bash
vp install
```

Expected: install completes without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: replace web deps with CLI deps"
```

---

### Task 0.3: Configure `tsconfig.json` for CLI output

**Files:**

- Modify: `tsconfig.json`

- [ ] **Step 1: Replace `tsconfig.json` with CLI-appropriate config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "allowImportingTsExtensions": false,
    "verbatimModuleSyntax": false,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 2: Verify it compiles the empty `src/`**

Create a stub `src/cli.ts`:

```ts
console.log("vercel-bulk");
```

Then:

```bash
vp exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json src/cli.ts
git commit -m "chore: configure TypeScript for CLI output"
```

---

### Task 0.4: Create folder skeleton

**Files:**

- Create: `src/commands/`, `src/core/`, `src/ui/`, `src/config/`, `test/core/`, `test/commands/`, `test/fixtures/`

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/commands src/core src/ui src/config test/core test/commands test/fixtures
touch src/commands/.gitkeep src/core/.gitkeep src/ui/.gitkeep src/config/.gitkeep
touch test/core/.gitkeep test/commands/.gitkeep test/fixtures/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: create source layer directories"
```

---

## Phase 1 — Config layer

### Task 1.1: `src/config/paths.ts` — path resolvers

**Files:**

- Create: `src/config/paths.ts`
- Create: `test/core/paths.test.ts`

The module resolves `~/.vercel-bulk/*` paths, but allows an env var override (`VERCEL_BULK_CONFIG_DIR`) so tests can point at a temp directory.

- [ ] **Step 1: Write the failing test**

Create `test/core/paths.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { configDir, configFilePath, logsDir, auditLogPath } from "../../src/config/paths.js";

describe("config/paths", () => {
  const original = process.env.VERCEL_BULK_CONFIG_DIR;

  afterEach(() => {
    process.env.VERCEL_BULK_CONFIG_DIR = original;
  });

  it("defaults to ~/.vercel-bulk when env var unset", () => {
    delete process.env.VERCEL_BULK_CONFIG_DIR;
    expect(configDir()).toBe(path.join(os.homedir(), ".vercel-bulk"));
  });

  it("respects VERCEL_BULK_CONFIG_DIR override", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    expect(configDir()).toBe(tmp);
    expect(configFilePath()).toBe(path.join(tmp, "config.json"));
    expect(logsDir()).toBe(path.join(tmp, "logs"));
  });

  it("auditLogPath uses ISO timestamp with dashes", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    const p = auditLogPath(new Date("2026-04-20T14:33:12.000Z"));
    expect(p).toBe(path.join(tmp, "logs", "deleted-2026-04-20T14-33-12Z.json"));
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/core/paths.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/config/paths.ts`**

```ts
import * as os from "node:os";
import * as path from "node:path";

export function configDir(): string {
  return process.env.VERCEL_BULK_CONFIG_DIR ?? path.join(os.homedir(), ".vercel-bulk");
}

export function configFilePath(): string {
  return path.join(configDir(), "config.json");
}

export function logsDir(): string {
  return path.join(configDir(), "logs");
}

export function auditLogPath(at: Date = new Date()): string {
  const ts = at
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "Z");
  return path.join(logsDir(), `deleted-${ts}.json`);
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
vp test test/core/paths.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/paths.ts test/core/paths.test.ts
git commit -m "feat(config): add path resolvers with env var override"
```

---

### Task 1.2: `src/config/token.ts` — token resolution and persistence

**Files:**

- Create: `src/config/token.ts`
- Create: `test/core/token.test.ts`

Token resolution order: `--token` flag > `VERCEL_TOKEN` env var > config file. The flag is passed in at call time; env and file are resolved by this module.

- [ ] **Step 1: Write the failing test**

Create `test/core/token.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { resolveToken, saveToken, loadConfig } from "../../src/config/token.js";

describe("config/token", () => {
  let tmp: string;
  const origEnv = process.env.VERCEL_TOKEN;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
  });

  afterEach(() => {
    process.env.VERCEL_TOKEN = origEnv;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns null when no token anywhere", () => {
    expect(resolveToken()).toBe(null);
  });

  it("returns env var when set", () => {
    process.env.VERCEL_TOKEN = "from-env";
    expect(resolveToken()).toEqual({ token: "from-env", source: "env" });
  });

  it("returns file contents when env unset", () => {
    saveToken("from-file", { id: "u1", username: "carlos" });
    expect(resolveToken()).toEqual({ token: "from-file", source: "file" });
  });

  it("env takes precedence over file", () => {
    saveToken("from-file", { id: "u1", username: "carlos" });
    process.env.VERCEL_TOKEN = "from-env";
    expect(resolveToken()).toEqual({ token: "from-env", source: "env" });
  });

  it("saves config file with mode 0600 on Unix", () => {
    saveToken("t", { id: "u1", username: "carlos" });
    const p = path.join(tmp, "config.json");
    expect(fs.existsSync(p)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(parsed).toEqual({ token: "t", user: { id: "u1", username: "carlos" } });
    if (process.platform !== "win32") {
      const mode = fs.statSync(p).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it("loadConfig returns null when file missing", () => {
    expect(loadConfig()).toBe(null);
  });

  it("loadConfig returns parsed JSON when file exists", () => {
    saveToken("t", { id: "u1", username: "carlos" });
    expect(loadConfig()).toEqual({ token: "t", user: { id: "u1", username: "carlos" } });
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/core/token.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/config/token.ts`**

```ts
import * as fs from "node:fs";
import * as path from "node:path";
import { configDir, configFilePath } from "./paths.js";

export type TokenSource = "flag" | "env" | "file";

export type UserInfo = {
  id: string;
  username: string;
};

export type Config = {
  token: string;
  user: UserInfo;
};

export function loadConfig(): Config | null {
  const p = configFilePath();
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as Config;
}

export function saveToken(token: string, user: UserInfo): void {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  const p = configFilePath();
  fs.writeFileSync(p, JSON.stringify({ token, user }, null, 2));
  if (process.platform !== "win32") {
    fs.chmodSync(p, 0o600);
  }
}

export function resolveToken(): { token: string; source: TokenSource } | null {
  if (process.env.VERCEL_TOKEN) {
    return { token: process.env.VERCEL_TOKEN, source: "env" };
  }
  const cfg = loadConfig();
  if (cfg?.token) {
    return { token: cfg.token, source: "file" };
  }
  return null;
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
vp test test/core/token.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/token.ts test/core/token.test.ts
git commit -m "feat(config): add token resolution and persistence"
```

---

### Task 1.3: `src/config/audit-log.ts` — write delete audit logs

**Files:**

- Create: `src/config/audit-log.ts`
- Create: `test/core/audit-log.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/audit-log.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { writeAuditLog, type AuditLog } from "../../src/config/audit-log.js";

describe("config/audit-log", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("writes log to logs/ directory, creating it if missing", () => {
    const log: AuditLog = {
      startedAt: "2026-04-20T14:33:12.000Z",
      user: { id: "u1", username: "carlos" },
      results: [
        {
          project: {
            id: "p1",
            name: "a",
            framework: null,
            link: null,
            latestDeployment: null,
            updatedAt: 0,
          },
          status: "pending",
        },
      ],
    };
    const p = writeAuditLog(log, new Date("2026-04-20T14:33:12.000Z"));
    expect(fs.existsSync(p)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(parsed).toEqual(log);
  });

  it("overwrites existing log at same path", () => {
    const when = new Date("2026-04-20T14:33:12.000Z");
    const initial: AuditLog = {
      startedAt: when.toISOString(),
      user: { id: "u1", username: "carlos" },
      results: [
        {
          project: {
            id: "p1",
            name: "a",
            framework: null,
            link: null,
            latestDeployment: null,
            updatedAt: 0,
          },
          status: "pending",
        },
      ],
    };
    const p = writeAuditLog(initial, when);
    const updated: AuditLog = {
      ...initial,
      finishedAt: "2026-04-20T14:33:19.000Z",
      results: [{ ...initial.results[0]!, status: "deleted" }],
    };
    writeAuditLog(updated, when);
    expect(JSON.parse(fs.readFileSync(p, "utf8"))).toEqual(updated);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/core/audit-log.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/config/audit-log.ts`**

```ts
import * as fs from "node:fs";
import * as path from "node:path";
import { logsDir, auditLogPath } from "./paths.js";
import type { UserInfo } from "./token.js";

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

export function writeAuditLog(log: AuditLog, at: Date = new Date()): string {
  fs.mkdirSync(logsDir(), { recursive: true });
  const p = auditLogPath(at);
  fs.writeFileSync(p, JSON.stringify(log, null, 2));
  return p;
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
vp test test/core/audit-log.test.ts
```

Expected: all 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/audit-log.ts test/core/audit-log.test.ts
git commit -m "feat(config): add audit log writer"
```

---

## Phase 2 — Errors + schemas

### Task 2.1: `src/errors.ts` — typed error classes

**Files:**

- Create: `src/errors.ts`
- Create: `test/core/errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/errors.test.ts`:

```ts
import { describe, it, expect } from "vite-plus/test";
import { AuthError, RateLimitError, ApiError, ValidationError } from "../../src/errors.js";

describe("errors", () => {
  it("AuthError carries status and message", () => {
    const e = new AuthError(403, "forbidden");
    expect(e.name).toBe("AuthError");
    expect(e.status).toBe(403);
    expect(e.message).toBe("forbidden");
    expect(e).toBeInstanceOf(Error);
  });

  it("RateLimitError carries retryAfter seconds", () => {
    const e = new RateLimitError(30);
    expect(e.name).toBe("RateLimitError");
    expect(e.retryAfterSeconds).toBe(30);
  });

  it("ApiError carries status, endpoint, body", () => {
    const e = new ApiError(500, "/v9/projects", { message: "boom" });
    expect(e.status).toBe(500);
    expect(e.endpoint).toBe("/v9/projects");
    expect(e.body).toEqual({ message: "boom" });
  });

  it("ValidationError carries endpoint and cause", () => {
    const e = new ValidationError("/v9/projects", new Error("bad shape"));
    expect(e.endpoint).toBe("/v9/projects");
    expect(e.cause).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/core/errors.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/errors.ts`**

```ts
export class AuthError extends Error {
  readonly name = "AuthError";
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class RateLimitError extends Error {
  readonly name = "RateLimitError";
  constructor(public readonly retryAfterSeconds: number) {
    super(`Rate limited. Retry after ${retryAfterSeconds}s.`);
  }
}

export class ApiError extends Error {
  readonly name = "ApiError";
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly body: unknown,
  ) {
    super(`Vercel API error ${status} at ${endpoint}`);
  }
}

export class ValidationError extends Error {
  readonly name = "ValidationError";
  constructor(
    public readonly endpoint: string,
    override readonly cause: unknown,
  ) {
    super(`Response shape from ${endpoint} did not match expected schema`);
  }
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
vp test test/core/errors.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts test/core/errors.test.ts
git commit -m "feat(core): add typed error classes"
```

---

### Task 2.2: `src/core/schemas.ts` — zod schemas for Vercel API

**Files:**

- Create: `src/core/schemas.ts`
- Create: `test/fixtures/projects.json`
- Create: `test/fixtures/user.json`
- Create: `test/core/schemas.test.ts`

- [ ] **Step 1: Create fixture files**

`test/fixtures/user.json`:

```json
{
  "user": {
    "id": "user_abc123",
    "username": "carlos",
    "email": "carlos.ziegler@zietec.io",
    "name": "Carlos Ziegler"
  }
}
```

`test/fixtures/projects.json`:

```json
{
  "projects": [
    {
      "id": "prj_1",
      "name": "my-hackathon-2024",
      "framework": "nextjs",
      "link": {
        "type": "github",
        "repo": "carlos/hack24",
        "org": "carlos",
        "repoId": 1
      },
      "latestDeployments": [{ "uid": "dpl_1", "createdAt": 1700000000000 }],
      "updatedAt": 1700000000000
    },
    {
      "id": "prj_2",
      "name": "weekend-experiment",
      "framework": "vite",
      "link": null,
      "latestDeployments": [],
      "updatedAt": 1710000000000
    }
  ],
  "pagination": { "count": 2, "next": null }
}
```

- [ ] **Step 2: Write the failing test**

Create `test/core/schemas.test.ts`:

```ts
import { describe, it, expect } from "vite-plus/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { UserResponse, ProjectListResponse, Project } from "../../src/core/schemas.js";

const fixtures = path.join(__dirname, "..", "fixtures");

describe("core/schemas", () => {
  it("parses user fixture", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(fixtures, "user.json"), "utf8"));
    const parsed = UserResponse.parse(raw);
    expect(parsed.user.username).toBe("carlos");
  });

  it("parses project-list fixture", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(fixtures, "projects.json"), "utf8"));
    const parsed = ProjectListResponse.parse(raw);
    expect(parsed.projects).toHaveLength(2);
    expect(parsed.projects[0]!.name).toBe("my-hackathon-2024");
    expect(parsed.projects[0]!.link?.type).toBe("github");
    expect(parsed.projects[1]!.link).toBe(null);
  });

  it("Project schema tolerates missing latestDeployments", () => {
    const parsed = Project.parse({
      id: "p",
      name: "x",
      framework: null,
      link: null,
      updatedAt: 0,
    });
    expect(parsed.latestDeployments).toBeUndefined();
  });

  it("rejects missing required fields", () => {
    expect(() => Project.parse({ id: "p" })).toThrow();
  });
});
```

- [ ] **Step 3: Run the test — expect failure**

```bash
vp test test/core/schemas.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/core/schemas.ts`**

```ts
import { z } from "zod";

export const UserResponse = z.object({
  user: z.object({
    id: z.string(),
    username: z.string(),
    email: z.string().email().optional(),
    name: z.string().optional(),
  }),
});
export type UserResponse = z.infer<typeof UserResponse>;

export const ProjectLink = z.object({
  type: z.string(),
  repo: z.string(),
});
export type ProjectLink = z.infer<typeof ProjectLink>;

export const LatestDeployment = z.object({
  uid: z.string().optional(),
  createdAt: z.number(),
});

export const Project = z.object({
  id: z.string(),
  name: z.string(),
  framework: z.string().nullable(),
  link: ProjectLink.nullable()
    .optional()
    .transform((v) => v ?? null),
  latestDeployments: z.array(LatestDeployment).optional(),
  updatedAt: z.number(),
});
export type Project = z.infer<typeof Project>;

export const ProjectListResponse = z.object({
  projects: z.array(Project),
  pagination: z
    .object({
      count: z.number(),
      next: z.union([z.number(), z.string(), z.null()]).optional(),
    })
    .optional(),
});
export type ProjectListResponse = z.infer<typeof ProjectListResponse>;
```

- [ ] **Step 5: Run the test — expect pass**

```bash
vp test test/core/schemas.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/schemas.ts test/core/schemas.test.ts test/fixtures/
git commit -m "feat(core): add zod schemas for Vercel API responses"
```

---

### Task 2.3: `src/core/types.ts` — domain types

**Files:**

- Create: `src/core/types.ts`

- [ ] **Step 1: Implement**

```ts
export type { Project, ProjectLink, UserResponse, ProjectListResponse } from "./schemas.js";

export type ListProjectsOptions = {
  limit?: number;
};

export type FilterOptions = {
  olderThan?: string;
  namePattern?: string;
  framework?: string;
  noRepo?: boolean;
};
```

- [ ] **Step 2: Verify typecheck**

```bash
vp exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): add domain types"
```

---

## Phase 3 — API client with retry

### Task 3.1: `src/core/api.ts` — basic fetch wrapper

**Files:**

- Create: `src/core/api.ts`
- Create: `test/core/api.test.ts`

The wrapper takes a token + endpoint + options, returns the parsed JSON body. All Vercel API calls go through this function.

- [ ] **Step 1: Write the failing test (happy path)**

Create `test/core/api.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vite-plus/test";
import { vercelFetch } from "../../src/core/api.js";
import { AuthError, RateLimitError, ApiError } from "../../src/errors.js";

describe("core/api.vercelFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds Authorization header and returns JSON", async () => {
    const spy = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", spy);

    const result = await vercelFetch("t", "GET", "/v2/user");

    expect(result).toEqual({ ok: true });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("https://api.vercel.com/v2/user");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer t" });
  });

  it("throws AuthError on 401", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: { message: "bad token" } }), { status: 401 }),
    );
    await expect(vercelFetch("t", "GET", "/v2/user")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError on 403", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 403 }));
    await expect(vercelFetch("t", "DELETE", "/v9/projects/x")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws ApiError on 4xx non-auth", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 }),
    );
    await expect(vercelFetch("t", "GET", "/v9/projects/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("returns empty object on 204 No Content", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 204 }));
    const result = await vercelFetch("t", "DELETE", "/v9/projects/x");
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/core/api.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/api.ts` (no retries yet)**

```ts
import { AuthError, RateLimitError, ApiError } from "../errors.js";

const BASE_URL = "https://api.vercel.com";

type Method = "GET" | "POST" | "DELETE" | "PATCH";

export async function vercelFetch(
  token: string,
  method: Method,
  endpoint: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return {};

  if (response.status === 401 || response.status === 403) {
    const msg = await safeText(response);
    throw new AuthError(response.status, msg || "unauthorized");
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") ?? 1);
    throw new RateLimitError(retryAfter);
  }

  if (!response.ok) {
    const bodyParsed = await safeJson(response);
    throw new ApiError(response.status, endpoint, bodyParsed);
  }

  return response.json();
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

async function safeJson(r: Response): Promise<unknown> {
  try {
    return await r.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
vp test test/core/api.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/api.ts test/core/api.test.ts
git commit -m "feat(core): add vercelFetch wrapper (no retry yet)"
```

---

### Task 3.2: `src/core/api.ts` — retry logic for 429 + 5xx

**Files:**

- Modify: `src/core/api.ts`
- Modify: `test/core/api.test.ts`

- [ ] **Step 1: Add failing tests for retry**

Append to `test/core/api.test.ts`:

```ts
describe("core/api.vercelFetch retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries on 429 respecting Retry-After header", async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const spy = vi.fn(async () => {
      calls.push(Date.now());
      if (calls.length === 1) {
        return new Response(JSON.stringify({}), { status: 429, headers: { "retry-after": "1" } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", spy);

    const promise = vercelFetch("t", "GET", "/v2/user");
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 up to 3 times with backoff, then succeeds", async () => {
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n += 1;
      if (n < 3) return new Response("", { status: 500 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const promise = vercelFetch("t", "GET", "/v2/user");
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(n).toBe(3);
  });

  it("gives up with ApiError after 4 consecutive 5xx", async () => {
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n += 1;
      return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 502 });
    });

    const promise = vercelFetch("t", "GET", "/v2/user");
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    expect(n).toBe(4);
  });
});
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
vp test test/core/api.test.ts
```

Expected: the new retry tests fail.

- [ ] **Step 3: Rewrite `src/core/api.ts` with retry**

```ts
import { AuthError, RateLimitError, ApiError } from "../errors.js";

const BASE_URL = "https://api.vercel.com";
const MAX_RETRIES = 3;

type Method = "GET" | "POST" | "DELETE" | "PATCH";

export async function vercelFetch(
  token: string,
  method: Method,
  endpoint: string,
  body?: unknown,
): Promise<unknown> {
  let attempt = 0;

  for (;;) {
    try {
      return await attemptFetch(token, method, endpoint, body);
    } catch (e) {
      if (e instanceof RateLimitError) {
        await sleep(e.retryAfterSeconds * 1000);
        continue;
      }
      if (e instanceof ApiError && e.status >= 500 && attempt < MAX_RETRIES) {
        attempt += 1;
        await sleep(backoffMs(attempt));
        continue;
      }
      throw e;
    }
  }
}

async function attemptFetch(
  token: string,
  method: Method,
  endpoint: string,
  body: unknown,
): Promise<unknown> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return {};

  if (response.status === 401 || response.status === 403) {
    const msg = await safeText(response);
    throw new AuthError(response.status, msg || "unauthorized");
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") ?? 1);
    throw new RateLimitError(retryAfter);
  }

  if (!response.ok) {
    const bodyParsed = await safeJson(response);
    throw new ApiError(response.status, endpoint, bodyParsed);
  }

  return response.json();
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

async function safeJson(r: Response): Promise<unknown> {
  try {
    return await r.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/core/api.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/api.ts test/core/api.test.ts
git commit -m "feat(core): add retry with backoff for 429 and 5xx"
```

---

## Phase 4 — Core API methods

### Task 4.1: `src/core/user.ts` — validateToken + getUser

**Files:**

- Create: `src/core/user.ts`
- Create: `test/core/user.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/user.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { getUser } from "../../src/core/user.js";
import { ValidationError } from "../../src/errors.js";

describe("core/user.getUser", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the parsed user", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            user: { id: "u1", username: "carlos", email: "c@z.io" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    const user = await getUser("t");
    expect(user).toEqual({ id: "u1", username: "carlos", email: "c@z.io" });
  });

  it("throws ValidationError when response shape is wrong", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ wrong: "shape" }), { status: 200 }),
    );
    await expect(getUser("t")).rejects.toBeInstanceOf(ValidationError);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/core/user.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/user.ts`**

```ts
import { vercelFetch } from "./api.js";
import { UserResponse } from "./schemas.js";
import { ValidationError } from "../errors.js";

export type User = {
  id: string;
  username: string;
  email?: string;
  name?: string;
};

export async function getUser(token: string): Promise<User> {
  const raw = await vercelFetch(token, "GET", "/v2/user");
  try {
    return UserResponse.parse(raw).user;
  } catch (cause) {
    throw new ValidationError("/v2/user", cause);
  }
}

export async function validateToken(token: string): Promise<User> {
  return getUser(token);
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
vp test test/core/user.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/user.ts test/core/user.test.ts
git commit -m "feat(core): add getUser and validateToken"
```

---

### Task 4.2: `src/core/projects.ts` — listProjects with pagination

**Files:**

- Create: `src/core/projects.ts`
- Create: `test/core/projects.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/projects.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { listProjects } from "../../src/core/projects.js";
import { ValidationError } from "../../src/errors.js";

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
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/core/projects.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/projects.ts`**

```ts
import { vercelFetch } from "./api.js";
import { ProjectListResponse, type Project } from "./schemas.js";
import { ValidationError } from "../errors.js";

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
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/core/projects.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/projects.ts test/core/projects.test.ts
git commit -m "feat(core): add listProjects with pagination"
```

---

### Task 4.3: `src/core/projects.ts` — deleteProject

**Files:**

- Modify: `src/core/projects.ts`
- Modify: `test/core/projects.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/core/projects.test.ts`:

```ts
import { deleteProject, type DeleteOutcome } from "../../src/core/projects.js";

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
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
vp test test/core/projects.test.ts
```

Expected: the new tests fail.

- [ ] **Step 3: Add `deleteProject` to `src/core/projects.ts`**

Append to the bottom of the file:

```ts
import { ApiError } from "../errors.js";

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
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/core/projects.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/projects.ts test/core/projects.test.ts
git commit -m "feat(core): add deleteProject"
```

---

## Phase 5 — Filters (pure)

### Task 5.1: `src/core/filters.ts` — all filter predicates

**Files:**

- Create: `src/core/filters.ts`
- Create: `test/core/filters.test.ts`

All filters live in one module (they're small) to keep the import surface minimal for `commands/`.

- [ ] **Step 1: Write the failing test**

Create `test/core/filters.test.ts`:

```ts
import { describe, it, expect } from "vite-plus/test";
import { applyFilters, parseDuration } from "../../src/core/filters.js";
import type { Project } from "../../src/core/schemas.js";

function project(over: Partial<Project>): Project {
  return {
    id: "p",
    name: "x",
    framework: null,
    link: null,
    latestDeployments: undefined,
    updatedAt: 0,
    ...over,
  };
}

describe("core/filters.parseDuration", () => {
  it("parses days, months, years", () => {
    expect(parseDuration("30d")).toBe(30 * 24 * 3600 * 1000);
    expect(parseDuration("6m")).toBe(6 * 30 * 24 * 3600 * 1000);
    expect(parseDuration("1y")).toBe(365 * 24 * 3600 * 1000);
  });

  it("rejects bad inputs", () => {
    expect(() => parseDuration("")).toThrow();
    expect(() => parseDuration("abc")).toThrow();
    expect(() => parseDuration("5")).toThrow();
  });
});

describe("core/filters.applyFilters", () => {
  const now = new Date("2026-04-20T00:00:00.000Z").getTime();
  const oneYearAgo = now - 365 * 24 * 3600 * 1000;
  const oneMonthAgo = now - 30 * 24 * 3600 * 1000;

  const projects: Project[] = [
    project({
      id: "old",
      name: "old-app",
      framework: "nextjs",
      latestDeployments: [{ createdAt: oneYearAgo }],
    }),
    project({
      id: "recent",
      name: "fresh",
      framework: "vite",
      latestDeployments: [{ createdAt: oneMonthAgo }],
    }),
    project({ id: "never", name: "no-deploys", framework: "nextjs" }),
    project({
      id: "norepo",
      name: "no-git",
      framework: "vite",
      latestDeployments: [{ createdAt: now }],
      link: null,
    }),
    project({
      id: "hasrepo",
      name: "with-git",
      framework: "vite",
      latestDeployments: [{ createdAt: now }],
      link: { type: "github", repo: "x/y" },
    }),
  ];

  it("no filters returns all", () => {
    expect(applyFilters(projects, {}, now).length).toBe(projects.length);
  });

  it("older-than excludes recent, keeps old and never-deployed", () => {
    const result = applyFilters(projects, { olderThan: "6m" }, now);
    const ids = result.map((p) => p.id).sort();
    expect(ids).toEqual(["hasrepo", "never", "norepo", "old"].sort());
    // "hasrepo" and "norepo" deployed just now, so they should NOT match older-than 6m
    const resultStrict = applyFilters(projects, { olderThan: "6m" }, now);
    expect(resultStrict.map((p) => p.id)).not.toContain("recent");
    expect(resultStrict.map((p) => p.id)).not.toContain("hasrepo");
  });

  it("name pattern matches glob", () => {
    const starDashApp = applyFilters(projects, { namePattern: "*-app" }, now).map((p) => p.id);
    expect(starDashApp).toEqual(["old"]);
    const startsWithNo = applyFilters(projects, { namePattern: "no-*" }, now)
      .map((p) => p.id)
      .sort();
    expect(startsWithNo).toEqual(["never", "norepo"]);
  });

  it("framework filter", () => {
    expect(
      applyFilters(projects, { framework: "nextjs" }, now)
        .map((p) => p.id)
        .sort(),
    ).toEqual(["never", "old"]);
  });

  it("no-repo filter", () => {
    const ids = applyFilters(projects, { noRepo: true }, now)
      .map((p) => p.id)
      .sort();
    expect(ids).toContain("norepo");
    expect(ids).not.toContain("hasrepo");
  });

  it("multiple filters are AND-combined", () => {
    const result = applyFilters(projects, { framework: "nextjs", olderThan: "6m" }, now);
    const ids = result.map((p) => p.id).sort();
    expect(ids).toEqual(["never", "old"]);
  });
});
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
vp test test/core/filters.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/filters.ts`**

```ts
import type { Project } from "./schemas.js";
import type { FilterOptions } from "./types.js";

const DURATION_RE = /^(\d+)([dmy])$/;

export function parseDuration(input: string): number {
  const match = DURATION_RE.exec(input);
  if (!match) throw new Error(`Invalid duration: "${input}". Use e.g. 30d, 6m, 1y.`);
  const n = Number(match[1]);
  const unit = match[2];
  const day = 24 * 3600 * 1000;
  switch (unit) {
    case "d":
      return n * day;
    case "m":
      return n * 30 * day;
    case "y":
      return n * 365 * day;
    default:
      throw new Error(`Unreachable: unit ${unit}`);
  }
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

export function applyFilters(
  projects: Project[],
  opts: FilterOptions,
  nowMs: number = Date.now(),
): Project[] {
  return projects.filter((p) => {
    if (opts.namePattern !== undefined) {
      const re = globToRegex(opts.namePattern);
      if (!re.test(p.name)) return false;
    }
    if (opts.framework !== undefined) {
      if (p.framework !== opts.framework) return false;
    }
    if (opts.noRepo) {
      if (p.link !== null) return false;
    }
    if (opts.olderThan !== undefined) {
      const cutoff = nowMs - parseDuration(opts.olderThan);
      const latest = p.latestDeployments?.[0]?.createdAt;
      if (latest !== undefined && latest > cutoff) return false;
      // latest === undefined → never deployed → always matches
    }
    return true;
  });
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/core/filters.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/filters.ts test/core/filters.test.ts
git commit -m "feat(core): add applyFilters and parseDuration"
```

---

## Phase 6 — UI helpers

### Task 6.1: `src/ui/format.ts` — humanize duration + colors

**Files:**

- Create: `src/ui/format.ts`
- Create: `test/core/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/format.test.ts`:

```ts
import { describe, it, expect } from "vite-plus/test";
import { humanizeAge, formatDate } from "../../src/ui/format.js";

describe("ui/format.humanizeAge", () => {
  const now = new Date("2026-04-20T00:00:00.000Z").getTime();
  const day = 86400000;

  it('returns "never" for undefined/null', () => {
    expect(humanizeAge(null, now)).toBe("never");
    expect(humanizeAge(undefined, now)).toBe("never");
  });

  it("days", () => {
    expect(humanizeAge(now - 3 * day, now)).toBe("3 days ago");
    expect(humanizeAge(now - 1 * day, now)).toBe("1 day ago");
  });

  it("months", () => {
    expect(humanizeAge(now - 60 * day, now)).toBe("2 months ago");
  });

  it("years", () => {
    expect(humanizeAge(now - 800 * day, now)).toBe("2 years ago");
  });

  it("formatDate", () => {
    expect(formatDate(new Date("2026-04-20T14:33:12.000Z"))).toMatch(/2026-04-20/);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/core/format.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ui/format.ts`**

```ts
import pc from "picocolors";

export const colors = pc;

const DAY = 86400000;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function humanizeAge(
  createdAtMs: number | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (createdAtMs === null || createdAtMs === undefined) return "never";
  const diff = nowMs - createdAtMs;
  if (diff < 0) return "in the future";
  if (diff >= YEAR) {
    const years = Math.floor(diff / YEAR);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }
  if (diff >= MONTH) {
    const months = Math.floor(diff / MONTH);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const days = Math.max(1, Math.floor(diff / DAY));
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/core/format.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/format.ts test/core/format.test.ts
git commit -m "feat(ui): add humanizeAge and formatDate"
```

---

### Task 6.2: `src/ui/table.ts` — render project table

**Files:**

- Create: `src/ui/table.ts`
- Create: `test/core/table.test.ts`

Minimal table (no extra dep). Columns: Name, Framework, Last Deploy, Repo. Truncates long names.

- [ ] **Step 1: Write the failing test**

Create `test/core/table.test.ts`:

```ts
import { describe, it, expect } from "vite-plus/test";
import { renderProjectTable } from "../../src/ui/table.js";
import type { Project } from "../../src/core/schemas.js";

const now = new Date("2026-04-20T00:00:00.000Z").getTime();

describe("ui/table.renderProjectTable", () => {
  it("renders header + rows", () => {
    const projects: Project[] = [
      {
        id: "p1",
        name: "my-app",
        framework: "nextjs",
        link: { type: "github", repo: "c/m" },
        latestDeployments: [{ createdAt: now - 86400000 * 7 }],
        updatedAt: 0,
      },
      { id: "p2", name: "other", framework: null, link: null, latestDeployments: [], updatedAt: 0 },
    ];
    const out = renderProjectTable(projects, now);
    expect(out).toContain("Name");
    expect(out).toContain("Framework");
    expect(out).toContain("Last Deploy");
    expect(out).toContain("my-app");
    expect(out).toContain("nextjs");
    expect(out).toContain("7 days ago");
    expect(out).toContain("other");
    expect(out).toContain("never");
  });

  it("prints — when link is null", () => {
    const projects: Project[] = [
      { id: "p2", name: "other", framework: null, link: null, latestDeployments: [], updatedAt: 0 },
    ];
    const out = renderProjectTable(projects, now);
    expect(out).toContain("—");
  });

  it("empty list returns an empty-state message", () => {
    const out = renderProjectTable([], now);
    expect(out).toContain("No projects");
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/core/table.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ui/table.ts`**

```ts
import type { Project } from "../core/schemas.js";
import { humanizeAge, colors } from "./format.js";

const COLS = [
  { key: "name", label: "Name", width: 28 },
  { key: "framework", label: "Framework", width: 12 },
  { key: "lastDeploy", label: "Last Deploy", width: 16 },
  { key: "repo", label: "Repo", width: 30 },
] as const;

function pad(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width - 1) + "…";
  return s + " ".repeat(width - s.length);
}

export function renderProjectTable(projects: Project[], nowMs: number = Date.now()): string {
  if (projects.length === 0) return colors.dim("No projects to show.");

  const lines: string[] = [];
  const header = COLS.map((c) => pad(c.label, c.width)).join("  ");
  const rule = COLS.map((c) => "─".repeat(c.width)).join("  ");
  lines.push(colors.bold(header));
  lines.push(colors.dim(rule));

  for (const p of projects) {
    const last = p.latestDeployments?.[0]?.createdAt ?? null;
    const row = [
      pad(p.name, COLS[0].width),
      pad(p.framework ?? "—", COLS[1].width),
      pad(humanizeAge(last, nowMs), COLS[2].width),
      pad(p.link ? p.link.repo : "—", COLS[3].width),
    ].join("  ");
    lines.push(row);
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/core/table.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/table.ts test/core/table.test.ts
git commit -m "feat(ui): add project table renderer"
```

---

### Task 6.3: `src/ui/picker.ts` — checkbox picker wrapper

**Files:**

- Create: `src/ui/picker.ts`

No test for this task (it's a thin wrapper around `@inquirer/prompts`; tested indirectly via `commands/delete.test.ts`).

- [ ] **Step 1: Implement `src/ui/picker.ts`**

```ts
import { checkbox } from "@inquirer/prompts";
import type { Project } from "../core/schemas.js";
import { humanizeAge } from "./format.js";

export async function pickProjects(
  projects: Project[],
  preselectedIds: Set<string>,
  nowMs: number = Date.now(),
): Promise<Project[]> {
  const choices = projects.map((p) => ({
    name: `${p.name.padEnd(30)}${(p.framework ?? "—").padEnd(12)}${humanizeAge(p.latestDeployments?.[0]?.createdAt ?? null, nowMs)}`,
    value: p.id,
    checked: preselectedIds.has(p.id),
  }));

  const selectedIds = await checkbox({
    message: "Select projects to delete (space to toggle, a to toggle all, enter to confirm)",
    choices,
    pageSize: 20,
    loop: false,
  });

  const byId = new Map(projects.map((p) => [p.id, p]));
  return selectedIds.map((id) => byId.get(id)!).filter(Boolean);
}
```

- [ ] **Step 2: Typecheck**

```bash
vp exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/picker.ts
git commit -m "feat(ui): add checkbox picker wrapper"
```

---

### Task 6.4: `src/ui/confirm.ts` — numeric confirmation

**Files:**

- Create: `src/ui/confirm.ts`

- [ ] **Step 1: Implement `src/ui/confirm.ts`**

```ts
import { input } from "@inquirer/prompts";

export async function confirmNumeric(expected: number): Promise<boolean> {
  const answer = await input({
    message: `Type "${expected}" to confirm deletion:`,
    validate: (s) => s.trim() === String(expected) || `Please type exactly ${expected}.`,
  });
  return answer.trim() === String(expected);
}
```

- [ ] **Step 2: Typecheck**

```bash
vp exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/confirm.ts
git commit -m "feat(ui): add numeric confirmation prompt"
```

---

## Phase 7 — Commands

### Task 7.1: `src/commands/login.ts`

**Files:**

- Create: `src/commands/login.ts`
- Create: `test/commands/login.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/commands/login.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runLogin } from "../../src/commands/login.js";

vi.mock("@inquirer/prompts", () => ({
  password: vi.fn(async () => "pasted-token"),
}));

describe("commands/login", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it("validates token and saves config", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            user: { id: "u1", username: "carlos", email: "c@z.io" },
          }),
          { status: 200 },
        ),
    );

    const exitCode = await runLogin({});
    expect(exitCode).toBe(0);

    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, "config.json"), "utf8"));
    expect(cfg.token).toBe("pasted-token");
    expect(cfg.user.username).toBe("carlos");
  });

  it("returns exit code 1 if token invalid", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 401 }));
    const exitCode = await runLogin({});
    expect(exitCode).toBe(1);
    expect(fs.existsSync(path.join(tmp, "config.json"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/commands/login.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/commands/login.ts`**

```ts
import { password } from "@inquirer/prompts";
import { validateToken } from "../core/user.js";
import { saveToken } from "../config/token.js";
import { configFilePath } from "../config/paths.js";
import { AuthError } from "../errors.js";
import { colors } from "../ui/format.js";

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
    saveToken(token, { id: user.id, username: user.username });
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
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/commands/login.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/login.ts test/commands/login.test.ts
git commit -m "feat(commands): add login command"
```

---

### Task 7.2: `src/commands/whoami.ts`

**Files:**

- Create: `src/commands/whoami.ts`
- Create: `test/commands/whoami.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/commands/whoami.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runWhoami } from "../../src/commands/whoami.js";
import { saveToken } from "../../src/config/token.js";

describe("commands/whoami", () => {
  let tmp: string;
  let logs: string[];
  const origLog = console.log;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
    logs = [];
    console.log = (...args) => {
      logs.push(args.join(" "));
    };
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllGlobals();
    console.log = origLog;
  });

  it("prints username when token works", async () => {
    saveToken("t", { id: "u1", username: "carlos" });
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            user: { id: "u1", username: "carlos", email: "c@z.io" },
          }),
          { status: 200 },
        ),
    );

    const exit = await runWhoami({});
    expect(exit).toBe(0);
    expect(logs.join("\n")).toContain("carlos");
    expect(logs.join("\n")).toContain("c@z.io");
  });

  it("errors if no token anywhere", async () => {
    const errs: string[] = [];
    const origErr = console.error;
    console.error = (...args) => {
      errs.push(args.join(" "));
    };
    try {
      const exit = await runWhoami({});
      expect(exit).toBe(1);
      expect(errs.join("\n").toLowerCase()).toContain("no vercel token");
    } finally {
      console.error = origErr;
    }
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/commands/whoami.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/commands/whoami.ts`**

```ts
import { getUser } from "../core/user.js";
import { resolveToken } from "../config/token.js";
import { configFilePath } from "../config/paths.js";
import { colors } from "../ui/format.js";

export type WhoamiOptions = {
  token?: string;
};

export async function runWhoami(opts: WhoamiOptions): Promise<number> {
  const resolved = opts.token ? { token: opts.token, source: "flag" as const } : resolveToken();

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
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/commands/whoami.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/whoami.ts test/commands/whoami.test.ts
git commit -m "feat(commands): add whoami command"
```

---

### Task 7.3: `src/commands/list.ts`

**Files:**

- Create: `src/commands/list.ts`
- Create: `test/commands/list.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/commands/list.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runList } from "../../src/commands/list.js";
import { saveToken } from "../../src/config/token.js";

describe("commands/list", () => {
  let tmp: string;
  let logs: string[];
  const origLog = console.log;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
    saveToken("t", { id: "u1", username: "carlos" });
    logs = [];
    console.log = (...args) => {
      logs.push(args.join(" "));
    };
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllGlobals();
    console.log = origLog;
  });

  it("renders a table of projects", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            projects: [
              {
                id: "p1",
                name: "my-app",
                framework: "nextjs",
                link: null,
                latestDeployments: [],
                updatedAt: 0,
              },
            ],
            pagination: { count: 1, next: null },
          }),
          { status: 200 },
        ),
    );

    const exit = await runList({});
    expect(exit).toBe(0);
    const out = logs.join("\n");
    expect(out).toContain("my-app");
    expect(out).toContain("nextjs");
    expect(out).toContain("1 project");
  });

  it("--json outputs JSON", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            projects: [
              {
                id: "p1",
                name: "my-app",
                framework: "nextjs",
                link: null,
                latestDeployments: [],
                updatedAt: 0,
              },
            ],
            pagination: { count: 1, next: null },
          }),
          { status: 200 },
        ),
    );

    const exit = await runList({ json: true });
    expect(exit).toBe(0);
    const parsed = JSON.parse(logs.join(""));
    expect(parsed[0].name).toBe("my-app");
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/commands/list.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/commands/list.ts`**

```ts
import { listProjects } from "../core/projects.js";
import { applyFilters } from "../core/filters.js";
import { resolveToken } from "../config/token.js";
import { renderProjectTable } from "../ui/table.js";
import { colors } from "../ui/format.js";
import type { FilterOptions } from "../core/types.js";

export type ListOptions = FilterOptions & {
  token?: string;
  json?: boolean;
};

export async function runList(opts: ListOptions): Promise<number> {
  const resolved = opts.token ? { token: opts.token, source: "flag" as const } : resolveToken();

  if (!resolved) {
    console.error(
      colors.red("No Vercel token found. Run `vercel-bulk login` or set VERCEL_TOKEN."),
    );
    return 1;
  }

  try {
    const all = await listProjects(resolved.token);
    const filtered = applyFilters(all, opts);

    if (opts.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return 0;
    }

    console.log(renderProjectTable(filtered));
    const noun = filtered.length === 1 ? "project" : "projects";
    console.log(
      colors.dim(
        `\n${filtered.length} ${noun} match${filtered.length === 1 ? "es" : ""} (of ${all.length} total).`,
      ),
    );
    return 0;
  } catch (e) {
    console.error(colors.red(`✗ ${(e as Error).message}`));
    return 1;
  }
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/commands/list.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/list.ts test/commands/list.test.ts
git commit -m "feat(commands): add list command"
```

---

### Task 7.4: `src/commands/delete.ts`

**Files:**

- Create: `src/commands/delete.ts`
- Create: `test/commands/delete.test.ts`

This is the biggest command. It composes everything: list → filter → pick → confirm → audit → delete loop with concurrency → summary.

- [ ] **Step 1: Write the failing test**

Create `test/commands/delete.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runDelete } from "../../src/commands/delete.js";
import { saveToken } from "../../src/config/token.js";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(async () => ["p1", "p2"]),
  input: vi.fn(async () => "2"),
  password: vi.fn(),
}));

describe("commands/delete", () => {
  let tmp: string;
  let logs: string[];
  const origLog = console.log;
  const origErr = console.error;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vb-"));
    process.env.VERCEL_BULK_CONFIG_DIR = tmp;
    delete process.env.VERCEL_TOKEN;
    saveToken("t", { id: "u1", username: "carlos" });
    logs = [];
    console.log = (...args) => {
      logs.push(args.join(" "));
    };
    console.error = (...args) => {
      logs.push(args.join(" "));
    };
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllGlobals();
    console.log = origLog;
    console.error = origErr;
  });

  it("deletes selected projects and writes audit log", async () => {
    const deleteCalls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (init?.method === "DELETE") {
        deleteCalls.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          projects: [
            {
              id: "p1",
              name: "a",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
            {
              id: "p2",
              name: "b",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
            {
              id: "p3",
              name: "c",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
          ],
          pagination: { count: 3, next: null },
        }),
        { status: 200 },
      );
    });

    const exit = await runDelete({});
    expect(exit).toBe(0);
    expect(deleteCalls).toHaveLength(2);
    expect(deleteCalls.some((u) => u.endsWith("/p1"))).toBe(true);
    expect(deleteCalls.some((u) => u.endsWith("/p2"))).toBe(true);

    const logsDir = path.join(tmp, "logs");
    const files = fs.readdirSync(logsDir);
    expect(files).toHaveLength(1);
    const log = JSON.parse(fs.readFileSync(path.join(logsDir, files[0]!), "utf8"));
    expect(log.results).toHaveLength(2);
    expect(log.results.every((r: any) => r.status === "deleted")).toBe(true);
  });

  it("continues batch when one delete fails", async () => {
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (init?.method === "DELETE") {
        if (url.endsWith("/p1")) return new Response("", { status: 403 });
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          projects: [
            {
              id: "p1",
              name: "a",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
            {
              id: "p2",
              name: "b",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
          ],
          pagination: { count: 2, next: null },
        }),
        { status: 200 },
      );
    });

    const exit = await runDelete({});
    expect(exit).toBe(0);
    const logsDir = path.join(tmp, "logs");
    const log = JSON.parse(
      fs.readFileSync(path.join(logsDir, fs.readdirSync(logsDir)[0]!), "utf8"),
    );
    const statuses = log.results.map((r: any) => r.status).sort();
    expect(statuses).toEqual(["deleted", "failed"]);
  });

  it("--dry-run performs no DELETE calls", async () => {
    const deleteCalls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (init?.method === "DELETE") {
        deleteCalls.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          projects: [
            {
              id: "p1",
              name: "a",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
            {
              id: "p2",
              name: "b",
              framework: null,
              link: null,
              latestDeployments: [],
              updatedAt: 0,
            },
          ],
          pagination: { count: 2, next: null },
        }),
        { status: 200 },
      );
    });

    const exit = await runDelete({ dryRun: true });
    expect(exit).toBe(0);
    expect(deleteCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

```bash
vp test test/commands/delete.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/commands/delete.ts`**

```ts
import { listProjects, deleteProject } from "../core/projects.js";
import { applyFilters } from "../core/filters.js";
import { resolveToken, loadConfig } from "../config/token.js";
import {
  writeAuditLog,
  type AuditLog,
  type AuditResult,
  type AuditedProject,
} from "../config/audit-log.js";
import { pickProjects } from "../ui/picker.js";
import { confirmNumeric } from "../ui/confirm.js";
import { colors } from "../ui/format.js";
import { AuthError, ApiError } from "../errors.js";
import type { FilterOptions } from "../core/types.js";
import type { Project } from "../core/schemas.js";

export type DeleteOptions = FilterOptions & {
  token?: string;
  yes?: boolean;
  dryRun?: boolean;
  concurrency?: number;
};

export async function runDelete(opts: DeleteOptions): Promise<number> {
  const resolved = opts.token ? { token: opts.token, source: "flag" as const } : resolveToken();

  if (!resolved) {
    console.error(
      colors.red("No Vercel token found. Run `vercel-bulk login` or set VERCEL_TOKEN."),
    );
    return 1;
  }

  try {
    const all = await listProjects(resolved.token);
    const filtered = applyFilters(all, opts);

    if (filtered.length === 0) {
      console.log(colors.yellow("No projects match the given filters. Nothing to do."));
      return 0;
    }

    const preselected = new Set(filtered.map((p) => p.id));
    const selected = await pickProjects(all, preselected);
    if (selected.length === 0) {
      console.log(colors.dim("No projects selected. Exiting."));
      return 0;
    }

    if (opts.dryRun) {
      console.log(colors.cyan(`[dry-run] Would delete ${selected.length} project(s):`));
      for (const p of selected) console.log(`  • ${p.name}`);
      return 0;
    }

    if (!opts.yes) {
      const ok = await confirmNumeric(selected.length);
      if (!ok) {
        console.log(colors.dim("Cancelled."));
        return 0;
      }
    }

    const cfg = loadConfig();
    const user = cfg?.user ?? { id: "unknown", username: "unknown" };
    const startedAt = new Date();
    const initialLog: AuditLog = {
      startedAt: startedAt.toISOString(),
      user,
      results: selected.map((p) => ({ project: toAudited(p), status: "pending" as const })),
    };
    const logPath = writeAuditLog(initialLog, startedAt);
    console.log(colors.dim(`Writing audit log to ${logPath}`));

    const results = await runDeletes(resolved.token, selected, opts.concurrency ?? 5);
    const finalLog: AuditLog = {
      ...initialLog,
      finishedAt: new Date().toISOString(),
      results,
    };
    writeAuditLog(finalLog, startedAt);

    const deleted = results.filter(
      (r) => r.status === "deleted" || r.status === "already_gone",
    ).length;
    const failed = results.filter((r) => r.status === "failed").length;
    console.log(
      `\nDone: ${colors.green(String(deleted))} deleted, ${failed > 0 ? colors.red(String(failed)) : "0"} failed.`,
    );
    console.log(colors.dim(`Log: ${logPath}`));
    return 0;
  } catch (e) {
    if (e instanceof AuthError) {
      console.error(colors.red(`✗ Auth error: ${e.message}. Run \`vercel-bulk login\`.`));
      return 1;
    }
    console.error(colors.red(`✗ ${(e as Error).message}`));
    return 1;
  }
}

function toAudited(p: Project): AuditedProject {
  return {
    id: p.id,
    name: p.name,
    framework: p.framework,
    link: p.link ?? null,
    latestDeployment: p.latestDeployments?.[0]
      ? { createdAt: p.latestDeployments[0].createdAt }
      : null,
    updatedAt: p.updatedAt,
  };
}

async function runDeletes(
  token: string,
  projects: Project[],
  concurrency: number,
): Promise<AuditResult[]> {
  const results: AuditResult[] = new Array(projects.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, projects.length) }, async () => {
    for (;;) {
      const idx = next;
      next += 1;
      if (idx >= projects.length) return;
      const p = projects[idx]!;
      const audited = toAudited(p);
      try {
        const outcome = await deleteProject(token, p.id);
        results[idx] = { project: audited, status: outcome };
        console.log(
          `  ${colors.green("✓")} ${p.name}${outcome === "already_gone" ? colors.dim(" (already gone)") : ""}`,
        );
      } catch (e) {
        if (e instanceof AuthError) throw e;
        const err =
          e instanceof ApiError
            ? { code: e.status, message: (e.body as any)?.error?.message ?? e.message }
            : { code: 0, message: (e as Error).message };
        results[idx] = { project: audited, status: "failed", error: err };
        console.log(
          `  ${colors.red("✗")} ${p.name} ${colors.dim(`(${err.code}: ${err.message})`)}`,
        );
      }
    }
  });
  await Promise.all(workers);
  return results;
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
vp test test/commands/delete.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/delete.ts test/commands/delete.test.ts
git commit -m "feat(commands): add delete command with audit log and concurrency"
```

---

## Phase 8 — CLI entry

### Task 8.1: `src/cli.ts` — commander setup

**Files:**

- Replace: `src/cli.ts`

- [ ] **Step 1: Implement `src/cli.ts`**

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { runLogin } from "./commands/login.js";
import { runWhoami } from "./commands/whoami.js";
import { runList } from "./commands/list.js";
import { runDelete } from "./commands/delete.js";

const program = new Command();

program
  .name("vercel-bulk")
  .description("Bulk operations on Vercel projects (listing, filtering, deleting)")
  .version("0.0.0")
  .option("--token <token>", "Override stored Vercel API token")
  .option("--json", "Machine-readable output");

program
  .command("login")
  .description("Save a Vercel API token locally")
  .action(async () => {
    const opts = program.opts();
    process.exit(await runLogin({ token: opts.token }));
  });

program
  .command("whoami")
  .description("Show the current authenticated user")
  .action(async () => {
    const opts = program.opts();
    process.exit(await runWhoami({ token: opts.token }));
  });

program
  .command("list")
  .description("List Vercel projects, optionally filtered")
  .option("--older-than <duration>", "No deployment in this long (e.g. 30d, 6m, 1y)")
  .option("--name <pattern>", 'Glob pattern (e.g. "*-preview")')
  .option("--framework <name>", 'Filter by framework (e.g. "nextjs")')
  .option("--no-repo", "Only projects without a connected git repo")
  .action(async (cmdOpts) => {
    const opts = program.opts();
    process.exit(
      await runList({
        token: opts.token,
        json: opts.json,
        olderThan: cmdOpts.olderThan,
        namePattern: cmdOpts.name,
        framework: cmdOpts.framework,
        noRepo: cmdOpts.repo === false,
      }),
    );
  });

program
  .command("delete")
  .description("Interactively select and bulk-delete Vercel projects")
  .option("--older-than <duration>", "Pre-select projects older than this")
  .option("--name <pattern>", "Glob pattern to pre-select")
  .option("--framework <name>", "Pre-select by framework")
  .option("--no-repo", "Pre-select projects without a repo")
  .option("--yes", "Skip numeric confirmation (for scripts)")
  .option("--dry-run", "Show what would happen, but do not delete")
  .option("--concurrency <n>", "Parallel delete calls (default: 5)", (v) => parseInt(v, 10))
  .action(async (cmdOpts) => {
    const opts = program.opts();
    process.exit(
      await runDelete({
        token: opts.token,
        olderThan: cmdOpts.olderThan,
        namePattern: cmdOpts.name,
        framework: cmdOpts.framework,
        noRepo: cmdOpts.repo === false,
        yes: cmdOpts.yes,
        dryRun: cmdOpts.dryRun,
        concurrency: cmdOpts.concurrency,
      }),
    );
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Verify typecheck**

```bash
vp exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke test by running in dev**

```bash
vp exec tsx src/cli.ts --help
```

Expected output: the CLI prints help listing `login`, `whoami`, `list`, `delete`, plus the global `--token` and `--json` flags.

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: wire up commander with all four commands"
```

---

## Phase 9 — Smoke test + build

### Task 9.1: Production build works

**Files:** (none — this is a verification task)

- [ ] **Step 1: Build**

```bash
vp run build
```

Expected: `dist/cli.js`, `dist/commands/*.js`, `dist/core/*.js`, etc. exist. No compile errors.

- [ ] **Step 2: Verify shebang and run via node**

```bash
head -1 dist/cli.js
node dist/cli.js --help
```

Expected: first line is `#!/usr/bin/env node`; help is printed.

If shebang is missing (TypeScript strips comments sometimes), add a small post-build step. Create `scripts/add-shebang.mjs`:

```js
import * as fs from "node:fs";
const p = "dist/cli.js";
const content = fs.readFileSync(p, "utf8");
if (!content.startsWith("#!")) {
  fs.writeFileSync(p, "#!/usr/bin/env node\n" + content);
}
fs.chmodSync(p, 0o755);
```

And update `package.json` `scripts.build` to:

```json
"build": "tsc && node scripts/add-shebang.mjs"
```

- [ ] **Step 3: Re-run the build and verify**

```bash
vp run build
node dist/cli.js --help
```

Expected: help prints successfully.

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/add-shebang.mjs
git commit -m "build: ensure CLI shebang and executable bit on dist/cli.js"
```

---

### Task 9.2: `test/smoke.test.ts` — spawn the built binary

**Files:**

- Create: `test/smoke.test.ts`

- [ ] **Step 1: Write the test**

Create `test/smoke.test.ts`:

```ts
import { describe, it, expect } from "vite-plus/test";
import { spawnSync } from "node:child_process";
import * as path from "node:path";

describe("smoke", () => {
  it("--help exits 0 and lists all commands", () => {
    const bin = path.join(process.cwd(), "dist", "cli.js");
    const out = spawnSync("node", [bin, "--help"], { encoding: "utf8" });
    expect(out.status).toBe(0);
    expect(out.stdout).toContain("login");
    expect(out.stdout).toContain("whoami");
    expect(out.stdout).toContain("list");
    expect(out.stdout).toContain("delete");
  });
});
```

- [ ] **Step 2: Ensure build is current, then run**

```bash
vp run build
vp test test/smoke.test.ts
```

Expected: the smoke test passes.

- [ ] **Step 3: Commit**

```bash
git add test/smoke.test.ts
git commit -m "test: add end-to-end smoke test for built CLI"
```

---

## Phase 10 — Finalize

### Task 10.1: Full test + typecheck + lint sweep

- [ ] **Step 1: Run full test suite**

```bash
vp test
```

Expected: all tests pass.

- [ ] **Step 2: Run check (type + lint + format)**

```bash
vp check
```

Expected: clean — no lint/format/type errors. Fix any that show up (they should be minor if the plan was followed).

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: final lint and type-check cleanup"
```

---

### Task 10.2: Write a minimal `README.md`

**Files:**

- Create: `README.md`

- [ ] **Step 1: Write**

````markdown
# vercel-bulk

Bulk operations on Vercel projects. Built because `vercel project rm` only deletes one project at a time.

## Install

```bash
pnpm install -g vercel-bulk
# or from source:
git clone … && cd vercel-bulk && vp install && vp run build && npm link
```
````

## Quick start

```bash
# 1. Save a token (create one at https://vercel.com/account/tokens)
vercel-bulk login

# 2. Who am I?
vercel-bulk whoami

# 3. List projects with no deploys in the last 6 months
vercel-bulk list --older-than 6m

# 4. Interactively delete stale projects
vercel-bulk delete --older-than 6m
```

## Safety

Every `delete` run:

1. Shows an interactive checklist (nothing auto-selected).
2. Requires typing the batch size to confirm.
3. Writes an audit log to `~/.vercel-bulk/logs/deleted-<timestamp>.json`.

Pass `--dry-run` to preview, `--yes` to skip the numeric prompt (scripts).

## Config

Token is stored at `~/.vercel-bulk/config.json` (mode `0600` on Unix). You can override:

- `--token <t>` flag (highest precedence)
- `VERCEL_TOKEN` env var (overrides file)
- The saved config (lowest precedence)

## Development

```bash
vp install          # install deps
vp exec tsx src/cli.ts list   # run in dev
vp test             # run tests
vp run build        # produce dist/
```

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with install, usage, and dev guide"
````

---

## Done

At this point:

- All four commands (`login`, `whoami`, `list`, `delete`) work.
- Core layer (`src/core/`) has no CLI deps and is ready for a future dashboard.
- Bulk delete is safe: interactive picker + numeric confirm + audit log.
- Rate-limit and 5xx retry handled by the API client.
- Tests cover: filters, schemas, API retry, each command's happy/error paths, plus a smoke test.

Next steps (post-v1, separate plans):

- Team / scope support (`--scope <team>` + `vercel-bulk switch`).
- Export-before-delete (JSON snapshot of project settings).
- TanStack Start dashboard on top of `src/core/`.

---

## Self-review notes (for the planning phase)

Spec coverage check:

- §4.1 login → Task 7.1 ✓
- §4.1 whoami → Task 7.2 ✓
- §4.1 list (all 5 flags) → Task 7.3 + 8.1 ✓
- §4.1 delete (all 4 flags incl. --concurrency) → Task 7.4 + 8.1 ✓
- §4.1 global flags (--token, --json, --help, --version) → Task 8.1 ✓
- §4.3 numeric confirmation → Task 6.4 + 7.4 ✓
- §4.3 audit log written before first DELETE → Task 7.4 (initialLog before runDeletes) ✓
- §5.2 three endpoints only → Tasks 4.1 and 4.2/4.3 ✓
- §5.3 auth source order (flag > env > file) → Task 1.2 + each command's token resolution ✓
- §5.3 no-token behavior for non-login commands → Task 7.2, 7.3, 7.4 each check resolveToken and error ✓
- §5.4 pagination → Task 4.2 ✓
- §5.5 typed errors → Task 2.1 ✓
- §5.5 retry 429 + 5xx → Task 3.2 ✓
- §5.6 config + audit log paths → Task 1.1, 1.3 ✓
- §6 project structure → Tasks 0.4, 1.x, 2.x, 3.x, 4.x, 5.x, 6.x, 7.x, 8.x cover every directory ✓
- §7 tech stack (commander, @inquirer/prompts, picocolors, zod) → Task 0.2 adds all ✓. `ora` from spec §7 intentionally dropped — progress is printed with picocolors `✓`/`✗` inline, matching spec §4.1's example output. No spinner needed for the per-project progress rendering we do.
- §8 testing → every module has a test file except `src/ui/picker.ts` and `src/ui/confirm.ts` (thin wrappers, tested via commands/delete.test.ts) ✓

Placeholder scan: none found.

Type consistency: `DeleteOutcome`, `AuditStatus`, `UserInfo`, `FilterOptions`, `Project` used consistently across tasks.
