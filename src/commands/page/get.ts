import { Command } from "commander";
import {
  getPage,
  getPageMarkdown,
  getBlocksRecursive,
  extractPageTitle,
  extractSimpleProperties,
} from "../../lib/client";
import {
  transformToXmlTypeScript,
  blocksToContent,
} from "../../lib/transformer";
import { handleNotionError, parsePageId } from "../../lib/errors";
import type { PageGetOptions, OutputFormat, PageContent } from "../../types";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * Execute page get command
 */
async function executePageGet(
  pageId: string,
  options: PageGetOptions
): Promise<void> {
  const format = options.format || "markdown";

  try {
    // Parse and validate page ID (handles URLs and raw IDs)
    const normalizedId = parsePageId(pageId);

    // Fetch page metadata
    const page = await getPage(normalizedId);

    if (!("properties" in page)) {
      console.error("Error: Unable to retrieve page properties");
      process.exit(1);
    }

    const pageResponse = page as PageObjectResponse;

    if (format === "markdown") {
      // Use native markdown endpoint with metadata header
      const title = extractPageTitle(pageResponse);
      const markdown = await getPageMarkdown(normalizedId);

      const lines: string[] = [];
      lines.push(`# ${title}`);
      lines.push(`> ${pageResponse.url}`);
      lines.push("");
      lines.push(markdown);
      console.log(lines.join("\n"));
      return;
    }

    // For JSON and XML formats, fetch full page structure
    const blocks = await getBlocksRecursive(normalizedId, options.depth);

    const pageContent: PageContent = {
      id: pageResponse.id,
      title: extractPageTitle(pageResponse),
      url: pageResponse.url,
      lastEdited: pageResponse.last_edited_time,
      properties: extractSimpleProperties(pageResponse),
      blocks: blocksToContent(blocks),
    };

    switch (format) {
      case "json":
        console.log(JSON.stringify(pageContent, null, 2));
        break;

      case "xml":
        console.log(transformToXmlTypeScript(pageContent));
        break;
    }
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Create page get command
 */
export function createPageGetCommand(): Command {
  const cmd = new Command("get")
    .description("Retrieve page content")
    .argument("<page-id>", "Notion page ID or URL")
    .option(
      "-f, --format <fmt>",
      "Output format: json, markdown, xml",
      "markdown"
    )
    .option("-D, --depth <n>", "Maximum block recursion depth")
    .action(async (pageId: string, opts) => {
      await executePageGet(pageId, {
        format: opts.format as OutputFormat,
        depth: opts.depth ? parseInt(opts.depth, 10) : undefined,
      });
    });

  return cmd;
}
