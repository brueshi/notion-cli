import { Command } from "commander";
import { saveConfig, showConfig } from "../lib/config";

/**
 * Create config command
 */
export function createConfigCommand(): Command {
  const cmd = new Command("config")
    .description("Manage Notion CLI configuration")
    .option("-t, --token <token>", "Set Notion API token")
    .option("-p, --parent <id>", "Set default parent page ID")
    .option("-s, --show", "Display current configuration")
    .action((opts) => {
      // If no options, show help
      if (!opts.token && !opts.parent && !opts.show) {
        cmd.help();
        return;
      }

      // Show config
      if (opts.show) {
        showConfig();
        return;
      }

      // Update config
      const updates: { token?: string; parentId?: string } = {};

      if (opts.token) {
        updates.token = opts.token;
        console.log("Token saved successfully.");
      }

      if (opts.parent) {
        updates.parentId = opts.parent;
        console.log("Default parent ID saved successfully.");
      }

      if (Object.keys(updates).length > 0) {
        saveConfig(updates);
      }
    });

  return cmd;
}
