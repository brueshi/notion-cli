import { Command } from "commander";
import { updatePage } from "../../lib/client";
import { handleNotionError, parsePageId } from "../../lib/errors";

/**
 * Execute page delete (archive) command
 */
async function executePageDelete(pageId: string): Promise<void> {
  try {
    const normalizedId = parsePageId(pageId);
    await updatePage(normalizedId, { archived: true });
    console.log("Page archived successfully.");
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Create page delete command
 */
export function createPageDeleteCommand(): Command {
  const cmd = new Command("delete")
    .description("Archive (soft-delete) a page")
    .argument("<page-id>", "Notion page ID or URL")
    .action(async (pageId: string) => {
      await executePageDelete(pageId);
    });

  return cmd;
}
