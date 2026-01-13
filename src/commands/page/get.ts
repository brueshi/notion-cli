import { Command } from "commander";
import { NotionToMarkdown } from "notion-to-md";
import { getClient, getPage, getBlocksRecursive, extractPageTitle } from "../../lib/client";
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

    // Fetch blocks recursively
    const blocks = await getBlocksRecursive(normalizedId, options.depth);

    // Build page content structure
    const pageContent: PageContent = {
      id: pageResponse.id,
      title: extractPageTitle(pageResponse),
      url: pageResponse.url,
      lastEdited: pageResponse.last_edited_time,
      properties: extractSimpleProperties(pageResponse),
      blocks: blocksToContent(blocks),
    };

    // Output based on format
    switch (format) {
      case "json":
        console.log(JSON.stringify(pageContent, null, 2));
        break;

      case "xml":
        console.log(transformToXmlTypeScript(pageContent));
        break;

      case "markdown":
      default:
        const markdown = await convertToMarkdown(normalizedId);
        console.log(markdown);
        break;
    }
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Extract simple property values from page
 */
function extractSimpleProperties(
  page: PageObjectResponse
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, prop] of Object.entries(page.properties)) {
    // Skip title property (handled separately)
    if ("title" in prop) continue;

    // Extract value based on property type
    if ("rich_text" in prop && Array.isArray(prop.rich_text)) {
      result[key] = prop.rich_text.map((t) => t.plain_text).join("");
    } else if ("select" in prop && prop.select) {
      result[key] = prop.select.name;
    } else if ("multi_select" in prop && Array.isArray(prop.multi_select)) {
      result[key] = prop.multi_select.map((s) => s.name).join(",");
    } else if ("status" in prop && prop.status) {
      result[key] = prop.status.name;
    } else if ("checkbox" in prop) {
      result[key] = prop.checkbox;
    } else if ("number" in prop) {
      result[key] = prop.number;
    } else if ("url" in prop) {
      result[key] = prop.url;
    } else if ("email" in prop) {
      result[key] = prop.email;
    } else if ("phone_number" in prop) {
      result[key] = prop.phone_number;
    } else if ("date" in prop && prop.date) {
      result[key] = prop.date.start;
    }
  }

  return result;
}

/**
 * Convert page to markdown using notion-to-md
 */
async function convertToMarkdown(pageId: string): Promise<string> {
  const client = getClient();
  const n2m = new NotionToMarkdown({ notionClient: client });

  const mdBlocks = await n2m.pageToMarkdown(pageId);
  const mdString = n2m.toMarkdownString(mdBlocks);

  // notion-to-md returns an object with parent property
  if (typeof mdString === "object" && "parent" in mdString) {
    return mdString.parent;
  }

  return String(mdString);
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
