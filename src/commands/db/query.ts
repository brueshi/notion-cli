import { Command } from "commander";
import { queryDatabase, extractPageTitle, extractSimpleProperties } from "../../lib/client";
import { escapeXml } from "../../lib/transformer";
import { handleNotionError, parsePageId } from "../../lib/errors";
import type { DbQueryOptions, OutputFormat } from "../../types";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * Execute database query command
 */
async function executeDbQuery(
  databaseId: string,
  options: DbQueryOptions
): Promise<void> {
  const format = options.format || "markdown";

  try {
    const normalizedId = parsePageId(databaseId);

    let filter: Record<string, unknown> | undefined;
    if (options.filter) {
      try {
        filter = JSON.parse(options.filter);
      } catch {
        console.error("Error: Invalid JSON filter.");
        console.error('\nHint: Use valid JSON, e.g. \'{"property":"Status","select":{"equals":"Done"}}\'');
        process.exit(1);
      }
    }

    let sorts: Array<Record<string, unknown>> | undefined;
    if (options.sort) {
      try {
        const parsed = JSON.parse(options.sort);
        sorts = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        console.error("Error: Invalid JSON sort.");
        console.error('\nHint: Use valid JSON, e.g. \'{"property":"Created","direction":"descending"}\'');
        process.exit(1);
      }
    }

    const response = await queryDatabase(normalizedId, {
      filter,
      sorts,
      pageSize: options.limit || 100,
    });

    // Extract page results
    const rows = response.results
      .filter((r): r is PageObjectResponse => r.object === "page" && "properties" in r)
      .map((page) => ({
        id: page.id,
        title: extractPageTitle(page),
        url: page.url,
        lastEdited: page.last_edited_time,
        properties: extractSimpleProperties(page),
      }));

    switch (format) {
      case "json":
        console.log(JSON.stringify(rows, null, 2));
        break;

      case "xml":
        console.log(formatRowsXml(rows));
        break;

      case "markdown":
      default:
        console.log(formatRowsMarkdown(rows));
        break;
    }
  } catch (error) {
    handleNotionError(error);
  }
}

interface DbRow {
  id: string;
  title: string;
  url: string;
  lastEdited: string;
  properties: Record<string, unknown>;
}

function formatRowsMarkdown(rows: DbRow[]): string {
  if (rows.length === 0) {
    return "No results found.";
  }

  const lines: string[] = [];
  for (const row of rows) {
    lines.push(`**${row.title}**`);
    lines.push(`  ID: ${row.id}`);

    for (const [key, value] of Object.entries(row.properties)) {
      if (value !== null && value !== undefined && value !== "") {
        lines.push(`  ${key}: ${value}`);
      }
    }

    lines.push(`  Last edited: ${row.lastEdited}`);
    lines.push("");
  }
  return lines.join("\n");
}

function formatRowsXml(rows: DbRow[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<query_results count="${rows.length}">`);

  for (const row of rows) {
    lines.push(`  <row id="${escapeXml(row.id)}">`);
    lines.push(`    <title>${escapeXml(row.title)}</title>`);

    for (const [key, value] of Object.entries(row.properties)) {
      if (value !== null && value !== undefined && value !== "") {
        lines.push(`    <prop name="${escapeXml(key)}">${escapeXml(String(value))}</prop>`);
      }
    }

    lines.push(`    <last_edited>${row.lastEdited}</last_edited>`);
    lines.push("  </row>");
  }

  lines.push("</query_results>");
  return lines.join("\n");
}

/**
 * Create database query command
 */
export function createDbQueryCommand(): Command {
  const cmd = new Command("query")
    .description("Query a database and return results")
    .argument("<database-id>", "Database ID or URL")
    .option("-F, --filter <json>", "Filter as JSON")
    .option("-s, --sort <json>", "Sort as JSON (single object or array)")
    .option("-l, --limit <n>", "Maximum results", "100")
    .option(
      "-f, --format <fmt>",
      "Output format: json, markdown, xml",
      "markdown"
    )
    .action(async (databaseId: string, opts) => {
      await executeDbQuery(databaseId, {
        filter: opts.filter,
        sort: opts.sort,
        limit: parseInt(opts.limit, 10),
        format: opts.format as OutputFormat,
      });
    });

  return cmd;
}
