import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import { createPage } from "../../lib/client";
import { loadConfig } from "../../lib/config";
import { handleNotionError, ValidationError } from "../../lib/errors";
import type { PageCreateOptions } from "../../types";

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

    // Set a timeout for stdin reading
    setTimeout(() => {
      if (chunks.length === 0) {
        resolve("");
      }
    }, 100);
  });
}

/**
 * Execute page create command
 */
async function executePageCreate(
  title: string,
  options: PageCreateOptions
): Promise<void> {
  try {
    // Determine parent ID (optional — omit for standalone workspace page)
    let parentId = options.parent;
    if (!parentId) {
      const config = loadConfig();
      parentId = config?.parentId;
    }

    // Get content from file or stdin
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

    // Create the page using native markdown support
    const response = await createPage({
      parentId,
      title,
      markdown: content || undefined,
    });

    // Output result
    const pageUrl =
      "url" in response
        ? response.url
        : `https://notion.so/${response.id.replace(/-/g, "")}`;

    const location = parentId ? "as subpage" : "in workspace";
    console.log(`Page created ${location} successfully!`);
    console.log(`  ID:  ${response.id}`);
    console.log(`  URL: ${pageUrl}`);
  } catch (error) {
    handleNotionError(error);
  }
}

/**
 * Create page create command
 */
export function createPageCreateCommand(): Command {
  const cmd = new Command("create")
    .description("Create a new page (standalone or as subpage)")
    .argument("<title>", "Page title")
    .option("-p, --parent <id>", "Parent page or database ID (omit for standalone page)")
    .option("-f, --file <path>", "Read content from markdown file")
    .option("--stdin", "Read content from stdin")
    .action(async (title: string, opts) => {
      await executePageCreate(title, {
        parent: opts.parent,
        file: opts.file,
        stdin: opts.stdin,
      });
    });

  return cmd;
}
