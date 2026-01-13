import { Command } from "commander";
import { createPageGetCommand } from "./get";
import { createPageCreateCommand } from "./create";

/**
 * Create page command group
 */
export function createPageCommand(): Command {
  const cmd = new Command("page").description("Page operations");

  cmd.addCommand(createPageGetCommand());
  cmd.addCommand(createPageCreateCommand());

  return cmd;
}
