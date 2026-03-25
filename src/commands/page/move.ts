import { Command } from "commander";
import { movePage } from "../../lib/client";
import { handleNotionError, parsePageId } from "../../lib/errors";

/**
 * Execute page move command
 */
async function executePageMove(
  pageId: string,
  options: { to: string; database?: boolean }
): Promise<void> {
  try {
    const normalizedId = parsePageId(pageId);
    const targetId = parsePageId(options.to);

    const response = await movePage(normalizedId, targetId, options.database);

    const pageUrl =
      "url" in response
        ? response.url
        : `https://notion.so/${response.id.replace(/-/g, "")}`;

    console.log("Page moved successfully!");
    console.log(`  URL: ${pageUrl}`);
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Create page move command
 */
export function createPageMoveCommand(): Command {
  const cmd = new Command("move")
    .description("Move a page to a new parent")
    .argument("<page-id>", "Notion page ID or URL to move")
    .requiredOption("--to <id>", "Target parent page or database ID")
    .option("-d, --database", "Target parent is a database")
    .action(async (pageId: string, opts) => {
      await executePageMove(pageId, {
        to: opts.to,
        database: opts.database,
      });
    });

  return cmd;
}
