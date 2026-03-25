import { Command } from "commander";
import { createPageGetCommand } from "./get";
import { createPageCreateCommand } from "./create";
import { createPageUpdateCommand } from "./update";
import { createPageMoveCommand } from "./move";
import { createPageDeleteCommand } from "./delete";

/**
 * Create page command group
 */
export function createPageCommand(): Command {
  const cmd = new Command("page").description("Page operations");

  cmd.addCommand(createPageGetCommand());
  cmd.addCommand(createPageCreateCommand());
  cmd.addCommand(createPageUpdateCommand());
  cmd.addCommand(createPageMoveCommand());
  cmd.addCommand(createPageDeleteCommand());

  return cmd;
}
