#!/usr/bin/env bun
import { Command } from "commander";
import { createSearchCommand } from "./commands/search";
import { createPageCommand } from "./commands/page";
import { createContextCommand } from "./commands/context";
import { createConfigCommand } from "./commands/config";

const program = new Command();

program
  .name("notion")
  .description("A fast, composable CLI for Notion")
  .version("0.0.1");

// Add commands
program.addCommand(createSearchCommand());
program.addCommand(createPageCommand());
program.addCommand(createContextCommand());
program.addCommand(createConfigCommand());

// Parse arguments
program.parse();
