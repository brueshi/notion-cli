import { Command } from "commander";
import {
  getPage,
  getPageMarkdown,
  getBlocksRecursive,
  extractPageTitle,
  extractSimpleProperties,
  extractChildPageIds,
  listComments,
} from "../lib/client";
import {
  transformToXmlTypeScript,
  blocksToContent,
  escapeXml,
} from "../lib/transformer";
import { handleNotionError, parsePageId } from "../lib/errors";
import type { PageContent } from "../types";
import type {
  PageObjectResponse,
  CommentObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

interface ContextOptions {
  format?: "xml" | "markdown";
  maxTokens?: number;
  includeComments?: boolean;
  includeChildren?: boolean;
}

/**
 * Approximate token count (rough: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to approximate token limit
 */
function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) {
    return text;
  }
  const truncated = text.slice(0, maxChars);
  // Cut at last newline to avoid mid-line truncation
  const lastNewline = truncated.lastIndexOf("\n");
  const cutPoint = lastNewline > maxChars * 0.8 ? lastNewline : maxChars;
  return truncated.slice(0, cutPoint) + "\n\n[truncated]";
}

/**
 * Fetch comments for a page, returning simplified format
 */
async function fetchComments(
  pageId: string
): Promise<Array<{ text: string; createdTime: string }>> {
  try {
    const response = await listComments(pageId);
    return response.results
      .filter((c): c is CommentObjectResponse => "rich_text" in c)
      .map((c) => ({
        text: c.rich_text.map((t) => t.plain_text).join(""),
        createdTime: c.created_time,
      }));
  } catch {
    // Comments may not be available for all pages
    return [];
  }
}

/**
 * Fetch a single page's full context (metadata + content)
 */
async function fetchPageContext(pageId: string): Promise<{
  pageContent: PageContent;
  blocks: Awaited<ReturnType<typeof getBlocksRecursive>>;
} | null> {
  try {
    const page = await getPage(pageId);
    if (!("properties" in page)) return null;

    const pageResponse = page as PageObjectResponse;
    const blocks = await getBlocksRecursive(pageId);

    return {
      pageContent: {
        id: pageResponse.id,
        title: extractPageTitle(pageResponse),
        url: pageResponse.url,
        lastEdited: pageResponse.last_edited_time,
        properties: extractSimpleProperties(pageResponse),
        blocks: blocksToContent(blocks),
      },
      blocks,
    };
  } catch {
    return null;
  }
}

/**
 * Format context as markdown with metadata header
 */
async function formatContextMarkdown(
  pageId: string,
  options: ContextOptions
): Promise<string> {
  const page = await getPage(pageId);
  if (!("properties" in page)) {
    return "Error: Unable to retrieve page properties";
  }

  const pageResponse = page as PageObjectResponse;
  const title = extractPageTitle(pageResponse);
  const properties = extractSimpleProperties(pageResponse);

  const sections: string[] = [];

  // Metadata header
  const header: string[] = [];
  header.push(`# ${title}`);
  header.push("");
  header.push(`- **ID:** ${pageResponse.id}`);
  header.push(`- **URL:** ${pageResponse.url}`);
  header.push(`- **Last edited:** ${pageResponse.last_edited_time}`);

  const propEntries = Object.entries(properties).filter(
    ([_, v]) => v !== null && v !== undefined && v !== ""
  );
  if (propEntries.length > 0) {
    for (const [key, value] of propEntries) {
      header.push(`- **${key}:** ${value}`);
    }
  }

  header.push("");
  header.push("---");
  header.push("");
  sections.push(header.join("\n"));

  // Page content
  const markdown = await getPageMarkdown(pageId);
  sections.push(markdown);

  // Comments
  if (options.includeComments) {
    const comments = await fetchComments(pageId);
    if (comments.length > 0) {
      const commentLines: string[] = [];
      commentLines.push("");
      commentLines.push("---");
      commentLines.push("");
      commentLines.push("## Comments");
      commentLines.push("");
      for (const c of comments) {
        commentLines.push(`- ${c.text} _(${c.createdTime})_`);
      }
      sections.push(commentLines.join("\n"));
    }
  }

  // Child pages
  if (options.includeChildren) {
    const blocks = await getBlocksRecursive(pageId, 1);
    const childIds = extractChildPageIds(blocks);

    for (const childId of childIds) {
      try {
        const childPage = await getPage(childId);
        if (!("properties" in childPage)) continue;

        const childTitle = extractPageTitle(childPage);
        const childMarkdown = await getPageMarkdown(childId);

        const childLines: string[] = [];
        childLines.push("");
        childLines.push("---");
        childLines.push("");
        childLines.push(`## Subpage: ${childTitle}`);
        childLines.push("");
        childLines.push(childMarkdown);
        sections.push(childLines.join("\n"));
      } catch {
        // Skip inaccessible child pages
      }
    }
  }

  let output = sections.join("\n");

  if (options.maxTokens) {
    output = truncateToTokens(output, options.maxTokens);
  }

  return output;
}

/**
 * Format context as XML with metadata, comments, and children
 */
async function formatContextXml(
  pageId: string,
  options: ContextOptions
): Promise<string> {
  const result = await fetchPageContext(pageId);
  if (!result) {
    return "Error: Unable to retrieve page properties";
  }

  const { pageContent, blocks } = result;

  const lines: string[] = [];

  // XML header
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  const editedDate = pageContent.lastEdited.split("T")[0];
  lines.push(
    `<notion_context id="${escapeXml(pageContent.id)}" title="${escapeXml(pageContent.title)}" url="${escapeXml(pageContent.url)}" edited="${editedDate}">`
  );

  // Properties
  const propsStr = Object.entries(pageContent.properties)
    .filter(([_, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${escapeXml(k)}="${escapeXml(String(v))}"`)
    .join(" ");

  if (propsStr) {
    lines.push(`  <props ${propsStr} />`);
  }

  // Main content
  lines.push("  <content>");
  const xmlContent = transformToXmlTypeScript(pageContent);
  // Extract just the content portion (skip the outer wrapper we already built)
  const contentMatch = xmlContent.match(/<content>([\s\S]*?)<\/content>/);
  if (contentMatch) {
    lines.push(contentMatch[1]!.trimEnd());
  }
  lines.push("  </content>");

  // Comments
  if (options.includeComments) {
    const comments = await fetchComments(pageId);
    if (comments.length > 0) {
      lines.push(`  <comments count="${comments.length}">`);
      for (const c of comments) {
        lines.push(`    <comment created="${c.createdTime}">${escapeXml(c.text)}</comment>`);
      }
      lines.push("  </comments>");
    }
  }

  // Child pages
  if (options.includeChildren) {
    const childIds = extractChildPageIds(blocks);

    if (childIds.length > 0) {
      lines.push("  <children>");
      for (const childId of childIds) {
        const childResult = await fetchPageContext(childId);
        if (!childResult) continue;

        const childEdited = childResult.pageContent.lastEdited.split("T")[0];
        lines.push(
          `    <child_page id="${escapeXml(childResult.pageContent.id)}" title="${escapeXml(childResult.pageContent.title)}" edited="${childEdited}">`
        );

        // Child content
        for (const block of childResult.pageContent.blocks) {
          lines.push(blockToXmlIndented(block, 6));
        }

        lines.push("    </child_page>");
      }
      lines.push("  </children>");
    }
  }

  lines.push("</notion_context>");

  let output = lines.join("\n");

  if (options.maxTokens) {
    output = truncateToTokens(output, options.maxTokens);
  }

  return output;
}

/**
 * Simple block-to-XML with configurable indent (avoids importing the full transformer)
 */
function blockToXmlIndented(
  block: { type: string; content: string; children?: any[] },
  indent: number
): string {
  const spaces = " ".repeat(indent);
  const content = escapeXml(block.content);

  const typeMap: Record<string, string> = {
    heading_1: "h1", heading_2: "h2", heading_3: "h3",
    paragraph: "p", bulleted_list_item: "li", numbered_list_item: "li",
    to_do: "todo", toggle: "toggle", quote: "blockquote",
    divider: "hr", callout: "callout", code: "code",
    image: "img", bookmark: "bookmark", equation: "equation",
    table: "table", table_row: "tr",
  };

  const tag = typeMap[block.type] || block.type;

  if (!content && !block.children?.length) {
    return `${spaces}<${tag} />`;
  }

  if (block.children?.length) {
    const lines = [`${spaces}<${tag}>${content}`];
    for (const child of block.children) {
      lines.push(blockToXmlIndented(child, indent + 2));
    }
    lines.push(`${spaces}</${tag}>`);
    return lines.join("\n");
  }

  return `${spaces}<${tag}>${content}</${tag}>`;
}

/**
 * Execute context command
 */
async function executeContext(
  pageId: string,
  options: ContextOptions
): Promise<void> {
  const format = options.format || "xml";

  try {
    const normalizedId = parsePageId(pageId);

    let output: string;
    if (format === "markdown") {
      output = await formatContextMarkdown(normalizedId, options);
    } else {
      output = await formatContextXml(normalizedId, options);
    }

    console.log(output);
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Create context command
 */
export function createContextCommand(): Command {
  const cmd = new Command("context")
    .description("Extract page content optimized for AI context windows")
    .argument("<page-id>", "Notion page ID or URL")
    .option("-f, --format <fmt>", "Output format: xml, markdown", "xml")
    .option("-t, --max-tokens <n>", "Approximate token limit for truncation")
    .option("-c, --include-comments", "Include page comments")
    .option("-C, --include-children", "Include content of child/linked pages")
    .action(async (pageId: string, opts) => {
      await executeContext(pageId, {
        format: opts.format as "xml" | "markdown",
        maxTokens: opts.maxTokens ? parseInt(opts.maxTokens, 10) : undefined,
        includeComments: opts.includeComments,
        includeChildren: opts.includeChildren,
      });
    });

  return cmd;
}
