import { Command } from "commander";
import { createComment, listComments } from "../../lib/client";
import { escapeXml } from "../../lib/transformer";
import { handleNotionError, parsePageId } from "../../lib/errors";
import type { OutputFormat } from "../../types";
import type { CommentObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * Execute comment add command
 */
async function executeCommentAdd(
  pageId: string,
  text: string
): Promise<void> {
  try {
    const normalizedId = parsePageId(pageId);
    const response = await createComment(normalizedId, text);
    console.log("Comment added successfully!");
    console.log(`  ID: ${response.id}`);
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Execute comment list command
 */
async function executeCommentList(
  pageId: string,
  options: { format?: OutputFormat }
): Promise<void> {
  const format = options.format || "markdown";

  try {
    const normalizedId = parsePageId(pageId);
    const response = await listComments(normalizedId);

    const comments = response.results
      .filter((c): c is CommentObjectResponse => "rich_text" in c)
      .map((c) => ({
        id: c.id,
        text: c.rich_text.map((t) => t.plain_text).join(""),
        createdTime: c.created_time,
        createdBy: c.created_by.id,
      }));

    switch (format) {
      case "json":
        console.log(JSON.stringify(comments, null, 2));
        break;

      case "xml": {
        const lines: string[] = [];
        lines.push('<?xml version="1.0" encoding="UTF-8"?>');
        lines.push(`<comments count="${comments.length}">`);
        for (const c of comments) {
          lines.push(`  <comment id="${escapeXml(c.id)}" created="${c.createdTime}">`);
          lines.push(`    ${escapeXml(c.text)}`);
          lines.push("  </comment>");
        }
        lines.push("</comments>");
        console.log(lines.join("\n"));
        break;
      }

      case "markdown":
      default: {
        if (comments.length === 0) {
          console.log("No comments found.");
          break;
        }
        for (const c of comments) {
          console.log(`- ${c.text}`);
          console.log(`  (${c.createdTime})`);
          console.log("");
        }
        break;
      }
    }
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Create comment command group
 */
export function createCommentCommand(): Command {
  const cmd = new Command("comment").description("Comment operations");

  cmd
    .command("add")
    .description("Add a comment to a page")
    .argument("<page-id>", "Notion page ID or URL")
    .argument("<text>", "Comment text")
    .action(async (pageId: string, text: string) => {
      await executeCommentAdd(pageId, text);
    });

  cmd
    .command("list")
    .description("List comments on a page")
    .argument("<page-id>", "Notion page ID or URL")
    .option(
      "-f, --format <fmt>",
      "Output format: json, markdown, xml",
      "markdown"
    )
    .action(async (pageId: string, opts) => {
      await executeCommentList(pageId, {
        format: opts.format as OutputFormat,
      });
    });

  return cmd;
}
