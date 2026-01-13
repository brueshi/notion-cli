import { Client } from "@notionhq/client";
import type {
  SearchResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
  BlockObjectResponse,
  PageObjectResponse,
  CreatePageResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { requireConfig } from "./config";

let clientInstance: Client | null = null;

/**
 * Get or create the Notion client instance
 */
export function getClient(): Client {
  if (!clientInstance) {
    const config = requireConfig();
    clientInstance = new Client({
      auth: config.token,
    });
  }
  return clientInstance;
}

/**
 * Search for pages and databases
 */
export async function search(
  query: string,
  options: {
    pageSize?: number;
    filterType?: "page" | "database";
    startCursor?: string;
  } = {}
): Promise<SearchResponse> {
  const client = getClient();

  const searchParams: Parameters<typeof client.search>[0] = {
    query,
    page_size: options.pageSize || 10,
  };

  if (options.filterType) {
    searchParams.filter = {
      property: "object",
      value: options.filterType,
    };
  }

  if (options.startCursor) {
    searchParams.start_cursor = options.startCursor;
  }

  return client.search(searchParams);
}

/**
 * Get page metadata
 */
export async function getPage(pageId: string): Promise<GetPageResponse> {
  const client = getClient();
  return client.pages.retrieve({ page_id: pageId });
}

/**
 * Get all blocks for a page or block (handles pagination)
 */
export async function getBlocks(
  blockId: string,
  options: { pageSize?: number } = {}
): Promise<BlockObjectResponse[]> {
  const client = getClient();
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response: ListBlockChildrenResponse =
      await client.blocks.children.list({
        block_id: blockId,
        page_size: options.pageSize || 100,
        start_cursor: cursor,
      });

    for (const block of response.results) {
      if ("type" in block) {
        blocks.push(block as BlockObjectResponse);
      }
    }

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return blocks;
}

/**
 * Recursively get all blocks including children
 */
export async function getBlocksRecursive(
  blockId: string,
  maxDepth: number = Infinity,
  currentDepth: number = 0
): Promise<BlockObjectResponse[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const blocks = await getBlocks(blockId);

  // Fetch children for blocks that have them
  for (const block of blocks) {
    if (block.has_children) {
      const children = await getBlocksRecursive(
        block.id,
        maxDepth,
        currentDepth + 1
      );
      // Attach children to parent block for later processing
      (block as BlockObjectResponse & { children?: BlockObjectResponse[] }).children = children;
    }
  }

  return blocks;
}

/**
 * Create a new page
 */
export async function createPage(options: {
  parentId: string;
  title: string;
  children?: Parameters<typeof Client.prototype.pages.create>[0]["children"];
  isDatabase?: boolean;
}): Promise<CreatePageResponse> {
  const client = getClient();

  const parent: { page_id: string } | { database_id: string } =
    options.isDatabase
      ? { database_id: options.parentId }
      : { page_id: options.parentId };

  return client.pages.create({
    parent,
    properties: {
      title: {
        title: [
          {
            text: {
              content: options.title,
            },
          },
        ],
      },
    },
    children: options.children,
  });
}

/**
 * Append blocks to a page
 */
export async function appendBlocks(
  pageId: string,
  children: Parameters<typeof Client.prototype.blocks.children.append>[0]["children"]
): Promise<void> {
  const client = getClient();
  await client.blocks.children.append({
    block_id: pageId,
    children,
  });
}

/**
 * Extract title from page response
 */
export function extractPageTitle(page: GetPageResponse): string {
  if (!("properties" in page)) {
    return "Untitled";
  }

  const properties = page.properties;

  // Try common title property names
  for (const key of ["title", "Title", "Name", "name"]) {
    const prop = properties[key];
    if (prop && "title" in prop && Array.isArray(prop.title)) {
      return prop.title.map((t) => t.plain_text).join("") || "Untitled";
    }
  }

  // Search for any title type property
  for (const prop of Object.values(properties)) {
    if (prop && "title" in prop && Array.isArray(prop.title)) {
      return prop.title.map((t) => t.plain_text).join("") || "Untitled";
    }
  }

  return "Untitled";
}

/**
 * Extract title from search result
 */
export function extractSearchResultTitle(
  result: SearchResponse["results"][0]
): string {
  if (!("properties" in result)) {
    return "Untitled";
  }

  // For pages
  if (result.object === "page") {
    return extractPageTitle(result as PageObjectResponse);
  }

  // For databases
  if (result.object === "database" && "title" in result) {
    const titleArray = result.title;
    if (Array.isArray(titleArray)) {
      return titleArray.map((t) => t.plain_text).join("") || "Untitled";
    }
  }

  return "Untitled";
}

export { Client };
