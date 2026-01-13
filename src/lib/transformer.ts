import { spawn, spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { PageContent, BlockContent } from "../types";

// Path to the Zig binary
const ZIG_BINARY = join(dirname(dirname(__dirname)), "zig", "zig-out", "bin", "notion-context");

/**
 * Check if Zig binary is available
 * Note: Zig 0.15+ has significant API changes. The binary needs to be built with:
 *   cd zig && zig build -Doptimize=ReleaseFast
 * Currently using TypeScript fallback for compatibility.
 */
export function hasZigBinary(): boolean {
  return existsSync(ZIG_BINARY);
}

/**
 * Transform page data to XML using Zig binary if available,
 * otherwise fallback to TypeScript implementation
 */
export async function transformToXml(
  pageData: PageContent,
  options: { maxTokens?: number } = {}
): Promise<string> {
  if (hasZigBinary()) {
    return transformWithZig(pageData, "xml");
  }
  return transformToXmlTypeScript(pageData);
}

/**
 * Transform using Zig binary
 */
async function transformWithZig(
  pageData: PageContent,
  format: "xml" | "md"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ZIG_BINARY, ["--format", format], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Zig binary failed: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });

    // Send page data to stdin
    proc.stdin.write(JSON.stringify(pageData));
    proc.stdin.end();
  });
}

/**
 * TypeScript fallback for XML transformation
 */
export function transformToXmlTypeScript(pageData: PageContent): string {
  const lines: string[] = [];

  // XML header
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  // Page element
  const editedDate = pageData.lastEdited.split("T")[0];
  lines.push(
    `<notion_page id="${escapeXml(pageData.id)}" title="${escapeXml(pageData.title)}" edited="${editedDate}">`
  );

  // Properties
  const propsStr = Object.entries(pageData.properties)
    .filter(([_, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${escapeXml(k)}="${escapeXml(String(v))}"`)
    .join(" ");

  if (propsStr) {
    lines.push(`  <props ${propsStr} />`);
  }

  // Content
  lines.push("  <content>");
  for (const block of pageData.blocks) {
    lines.push(blockToXml(block, 4));
  }
  lines.push("  </content>");

  lines.push("</notion_page>");

  return lines.join("\n");
}

/**
 * Convert a block to XML representation
 */
function blockToXml(block: BlockContent, indent: number): string {
  const spaces = " ".repeat(indent);
  const content = escapeXml(block.content);

  // Map block types to XML elements
  const typeMap: Record<string, string> = {
    heading_1: "h1",
    heading_2: "h2",
    heading_3: "h3",
    paragraph: "p",
    bulleted_list_item: "li",
    numbered_list_item: "li",
    to_do: "todo",
    toggle: "toggle",
    quote: "blockquote",
    divider: "hr",
    callout: "callout",
    code: "code",
    image: "img",
    video: "video",
    file: "file",
    pdf: "pdf",
    bookmark: "bookmark",
    equation: "equation",
    table_of_contents: "toc",
    breadcrumb: "breadcrumb",
    column_list: "columns",
    column: "column",
    synced_block: "synced",
    template: "template",
    link_preview: "link",
    link_to_page: "pageref",
    table: "table",
    table_row: "tr",
  };

  const tag = typeMap[block.type] || block.type;

  // Self-closing tags for empty content
  if (!content && !block.children?.length) {
    if (block.type === "divider") {
      return `${spaces}<${tag} />`;
    }
    return `${spaces}<${tag} />`;
  }

  // Handle code blocks with language
  if (block.type === "code") {
    // Try to extract language from content or use plain
    return `${spaces}<${tag} lang="plain">${content}</${tag}>`;
  }

  // Elements with children
  if (block.children?.length) {
    const lines = [`${spaces}<${tag}>${content}`];
    for (const child of block.children) {
      lines.push(blockToXml(child, indent + 2));
    }
    lines.push(`${spaces}</${tag}>`);
    return lines.join("\n");
  }

  // Simple elements
  return `${spaces}<${tag}>${content}</${tag}>`;
}

/**
 * Escape XML special characters
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Extract text content from a Notion block
 */
export function extractBlockContent(block: BlockObjectResponse): string {
  const type = block.type as keyof typeof block;
  const blockData = block[type];

  if (!blockData || typeof blockData !== "object") {
    return "";
  }

  // Handle rich text blocks
  if ("rich_text" in blockData && Array.isArray(blockData.rich_text)) {
    return blockData.rich_text.map((t: { plain_text: string }) => t.plain_text).join("");
  }

  // Handle code blocks
  if ("caption" in blockData && "language" in blockData && "rich_text" in blockData) {
    const code = Array.isArray(blockData.rich_text)
      ? blockData.rich_text.map((t: { plain_text: string }) => t.plain_text).join("")
      : "";
    return code;
  }

  // Handle equation blocks
  if ("expression" in blockData) {
    return String(blockData.expression);
  }

  // Handle bookmark/link blocks
  if ("url" in blockData) {
    return String(blockData.url);
  }

  return "";
}

/**
 * Convert Notion blocks to simplified BlockContent structure
 */
export function blocksToContent(
  blocks: (BlockObjectResponse & { children?: BlockObjectResponse[] })[]
): BlockContent[] {
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    content: extractBlockContent(block),
    children: block.children ? blocksToContent(block.children) : undefined,
  }));
}
