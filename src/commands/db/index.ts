import { Command } from "commander";
import { createDbQueryCommand } from "./query";

/**
 * Create database command group
 */
export function createDbCommand(): Command {
  const cmd = new Command("db").description("Database operations");

  cmd.addCommand(createDbQueryCommand());

  return cmd;
}
