import { select } from "@inquirer/prompts";
import { colors } from "../ui/format";
import { runDelete } from "./delete";
import { runHistory } from "./history";
import { runList } from "./list";
import { runLogin } from "./login";
import { runLogout } from "./logout";
import { runWhoami } from "./whoami";

type MenuAction = "list" | "delete" | "history" | "whoami" | "login" | "logout" | "exit";

async function pickAction(): Promise<MenuAction> {
  return (await select({
    message: "What would you like to do?",
    choices: [
      { name: "List projects", value: "list" },
      { name: "Delete projects (interactive)", value: "delete" },
      { name: "History (browse past delete batches)", value: "history" },
      { name: "Who am I?", value: "whoami" },
      { name: "Login (save Vercel token)", value: "login" },
      { name: "Logout (remove local token)", value: "logout" },
      { name: "Exit", value: "exit" },
    ],
  })) as MenuAction;
}

async function runAction(action: Exclude<MenuAction, "exit">): Promise<number> {
  switch (action) {
    case "list":
      return runList({});
    case "delete":
      return runDelete({});
    case "history":
      return runHistory({});
    case "whoami":
      return runWhoami({});
    case "login":
      return runLogin({});
    case "logout":
      return runLogout({});
  }
}

export async function runMenu(): Promise<number> {
  console.log(colors.bold("\nvercel-bulk") + colors.dim(" — bulk operations on Vercel projects\n"));

  for (;;) {
    const action = await pickAction();
    if (action === "exit") return 0;
    await runAction(action);
    console.log(colors.dim("\n───────────────────────────────────────────\n"));
  }
}
