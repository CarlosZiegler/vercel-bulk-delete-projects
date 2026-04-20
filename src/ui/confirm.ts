import { input } from "@inquirer/prompts";

export async function confirmNumeric(expected: number): Promise<boolean> {
  const answer = await input({
    message: `Type "${expected}" to confirm deletion:`,
    validate: (s) => s.trim() === String(expected) || `Please type exactly ${expected}.`,
  });
  return answer.trim() === String(expected);
}
