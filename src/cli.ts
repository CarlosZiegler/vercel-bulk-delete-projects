#!/usr/bin/env node
import { Command } from "commander";
import { runDelete } from "./commands/delete";
import { runHistory } from "./commands/history";
import { runList } from "./commands/list";
import { runLogin } from "./commands/login";
import { runLogout } from "./commands/logout";
import { runMenu } from "./commands/menu";
import { runWhoami } from "./commands/whoami";

const program = new Command();

program
  .name("vercel-bulk-delete-projects")
  .description("Bulk operations on Vercel projects (listing, filtering, deleting)")
  .version("0.0.0")
  .option("--token <token>", "Override stored Vercel API token")
  .option("--json", "Machine-readable output")
  .action(async () => {
    process.exit(await runMenu());
  });

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
  .command("logout")
  .description("Remove the locally stored Vercel token")
  .option("--yes", "Skip confirmation prompt")
  .option("--all", "Also remove audit logs")
  .action(async (cmdOpts) => {
    process.exit(await runLogout({ yes: cmdOpts.yes, all: cmdOpts.all }));
  });

program
  .command("history")
  .description("Browse past delete batches (from the audit logs)")
  .action(async () => {
    const opts = program.opts();
    process.exit(await runHistory({ json: opts.json }));
  });

program
  .command("list")
  .description("List Vercel projects, optionally filtered")
  .option("--older-than <duration>", "No deployment in this long (e.g. 30d, 6m, 1y)")
  .option("--name <pattern>", 'Glob pattern (e.g. "*-preview")')
  .option("--framework <name>", 'Filter by framework (e.g. "nextjs")')
  .option("--no-repo", "Only projects without a connected git repo")
  .option("--sort <field>", "Sort by: name | last-deploy | updated (default: last-deploy)")
  .option("--reverse", "Reverse the sort order")
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
        sort: cmdOpts.sort,
        reverse: cmdOpts.reverse,
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
  .option("--sort <field>", "Sort by: name | last-deploy | updated (default: last-deploy)")
  .option("--reverse", "Reverse the sort order")
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
        sort: cmdOpts.sort,
        reverse: cmdOpts.reverse,
      }),
    );
  });

program.parseAsync(process.argv).catch((e) => {
  // Ctrl-C inside an @inquirer/prompts prompt throws ExitPromptError — exit cleanly
  if (e && typeof e === "object" && (e as { name?: string }).name === "ExitPromptError") {
    process.exit(130); // 128 + SIGINT(2)
  }
  console.error(e);
  process.exit(1);
});
