import { Command } from "commander";
import { search, extractSearchResultTitle } from "../lib/client";
import { escapeXml } from "../lib/transformer";
import { handleNotionError } from "../lib/errors";
import type { SearchOptions, SearchResult, OutputFormat } from "../types";

/**
 * Format search results based on output format
 */
function formatResults(results: SearchResult[], format: OutputFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(results, null, 2);

    case "xml":
      return formatResultsXml(results);

    case "markdown":
    default:
      return formatResultsMarkdown(results);
  }
}

/**
 * Format results as markdown
 */
function formatResultsMarkdown(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No results found.";
  }

  const lines: string[] = [];
  for (const result of results) {
    const icon = result.type === "page" ? "📄" : "🗃️";
    lines.push(`${icon} **${result.title}**`);
    lines.push(`   ID: ${result.id}`);
    lines.push(`   URL: ${result.url}`);
    lines.push(`   Last edited: ${result.lastEdited}`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Format results as XML
 */
function formatResultsXml(results: SearchResult[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<search_results count="${results.length}">`);

  for (const result of results) {
    lines.push(
      `  <result type="${result.type}" id="${escapeXml(result.id)}">`
    );
    lines.push(`    <title>${escapeXml(result.title)}</title>`);
    lines.push(`    <url>${escapeXml(result.url)}</url>`);
    lines.push(`    <last_edited>${result.lastEdited}</last_edited>`);
    lines.push("  </result>");
  }

  lines.push("</search_results>");
  return lines.join("\n");
}

/**
 * Execute search command
 */
async function executeSearch(
  query: string,
  options: SearchOptions
): Promise<void> {
  const format = options.format || "markdown";

  // Determine filter type
  let filterType: "page" | "database" | undefined;
  if (options.pages && !options.databases) {
    filterType = "page";
  } else if (options.databases && !options.pages) {
    filterType = "database";
  }

  try {
    const response = await search(query, {
      pageSize: options.limit || 10,
      filterType,
    });

    // Transform results to simplified format
    const results: SearchResult[] = response.results.map((result) => {
      const isPage = result.object === "page";
      const lastEdited =
        "last_edited_time" in result
          ? result.last_edited_time
          : new Date().toISOString();

      return {
        id: result.id,
        type: isPage ? "page" : "database",
        title: extractSearchResultTitle(result),
        url: "url" in result ? (result as any).url : `https://notion.so/${result.id.replace(/-/g, "")}`,
        lastEdited,
      };
    });

    console.log(formatResults(results, format));
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Create search command
 */
export function createSearchCommand(): Command {
  const cmd = new Command("search")
    .description("Search pages and databases in your Notion workspace")
    .argument("<query>", "Search query")
    .option("-l, --limit <n>", "Maximum results", "10")
    .option(
      "-f, --format <fmt>",
      "Output format: json, markdown, xml",
      "markdown"
    )
    .option("-p, --pages", "Filter to pages only")
    .option("-d, --databases", "Filter to databases only")
    .action(async (query: string, opts) => {
      await executeSearch(query, {
        limit: parseInt(opts.limit, 10),
        format: opts.format as OutputFormat,
        pages: opts.pages,
        databases: opts.databases,
      });
    });

  return cmd;
}
