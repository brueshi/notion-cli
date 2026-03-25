import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import { updatePage, updatePageMarkdown } from "../../lib/client";
import { handleNotionError, parsePageId, ValidationError } from "../../lib/errors";
import type { PageUpdateOptions } from "../../types";

/**
 * Read content from stdin
 */
async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];

  return new Promise((resolve, reject) => {
    process.stdin.on("data", (chunk) => {
      if (typeof chunk === "string") {
        chunks.push(new TextEncoder().encode(chunk));
      } else {
        chunks.push(chunk);
      }
    });
    process.stdin.on("end", () => {
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(new TextDecoder().decode(result));
    });
    process.stdin.on("error", reject);

    setTimeout(() => {
      if (chunks.length === 0) {
        resolve("");
      }
    }, 100);
  });
}

/**
 * Execute page update command
 */
async function executePageUpdate(
  pageId: string,
  options: PageUpdateOptions
): Promise<void> {
  try {
    const normalizedId = parsePageId(pageId);

    // Update title if provided
    if (options.title) {
      await updatePage(normalizedId, { title: options.title });
    }

    // Update content from file or stdin
    let content = "";
    if (options.file) {
      if (!existsSync(options.file)) {
        throw new ValidationError(
          `File not found: ${options.file}`,
          "Check that the file path is correct."
        );
      }
      content = readFileSync(options.file, "utf-8");
    } else if (options.stdin) {
      content = await readStdin();
    }

    if (content) {
      await updatePageMarkdown(normalizedId, content, "replace");
    }

    if (!options.title && !content) {
      throw new ValidationError(
        "Nothing to update.",
        "Use --title, --file, or --stdin to specify what to update."
      );
    }

    console.log("Page updated successfully!");
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Create page update command
 */
export function createPageUpdateCommand(): Command {
  const cmd = new Command("update")
    .description("Update a page's title or content")
    .argument("<page-id>", "Notion page ID or URL")
    .option("-t, --title <title>", "New page title")
    .option("-f, --file <path>", "Replace content from markdown file")
    .option("--stdin", "Replace content from stdin")
    .action(async (pageId: string, opts) => {
      await executePageUpdate(pageId, {
        title: opts.title,
        file: opts.file,
        stdin: opts.stdin,
      });
    });

  return cmd;
}
