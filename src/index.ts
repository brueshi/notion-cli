#!/usr/bin/env bun
import { Command } from "commander";
import { createSearchCommand } from "./commands/search";
import { createPageCommand } from "./commands/page";
import { createContextCommand } from "./commands/context";
import { createConfigCommand } from "./commands/config";
import { createDbCommand } from "./commands/db";
import { createCommentCommand } from "./commands/comment";

const program = new Command();

program
  .name("notion")
  .description("A fast, composable CLI for Notion")
  .version("0.1.0");

// Add commands
program.addCommand(createSearchCommand());
program.addCommand(createPageCommand());
program.addCommand(createContextCommand());
program.addCommand(createConfigCommand());
program.addCommand(createDbCommand());
program.addCommand(createCommentCommand());

// Parse arguments
program.parse();
