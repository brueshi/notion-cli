import { Client } from "@notionhq/client";
import type {
  SearchResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
  BlockObjectResponse,
  PageObjectResponse,
  CreatePageResponse,
  GetPageMarkdownResponse,
  UpdatePageMarkdownResponse,
  MovePageResponse,
  QueryDataSourceResponse,
  CreateCommentResponse,
  ListCommentsResponse,
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
      value: options.filterType === "database" ? "data_source" : "page",
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
 * Get page content as markdown (native SDK endpoint)
 */
export async function getPageMarkdown(pageId: string): Promise<string> {
  const client = getClient();
  const response: GetPageMarkdownResponse = await client.pages.retrieveMarkdown({
    page_id: pageId,
  });
  return response.markdown;
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
 * When no parentId is provided, creates a standalone workspace-level page.
 */
export async function createPage(options: {
  parentId?: string;
  title: string;
  children?: Parameters<typeof Client.prototype.pages.create>[0]["children"];
  markdown?: string;
  isDatabase?: boolean;
}): Promise<CreatePageResponse> {
  const client = getClient();

  // Determine parent: workspace-level if no parentId
  let parent: Parameters<typeof Client.prototype.pages.create>[0]["parent"];
  if (options.parentId) {
    parent = options.isDatabase
      ? { database_id: options.parentId }
      : { page_id: options.parentId };
  } else {
    parent = { workspace: true };
  }

  const createParams: Parameters<typeof Client.prototype.pages.create>[0] = {
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
  };

  // Use native markdown parameter if available, otherwise use children blocks
  if (options.markdown) {
    createParams.markdown = options.markdown;
  } else if (options.children) {
    createParams.children = options.children;
  }

  return client.pages.create(createParams);
}

/**
 * Update a page's properties
 */
export async function updatePage(
  pageId: string,
  options: {
    title?: string;
    archived?: boolean;
  }
): Promise<GetPageResponse> {
  const client = getClient();

  const updateParams: Parameters<typeof Client.prototype.pages.update>[0] = {
    page_id: pageId,
  };

  if (options.title !== undefined) {
    updateParams.properties = {
      title: {
        title: [
          {
            text: {
              content: options.title,
            },
          },
        ],
      },
    };
  }

  if (options.archived !== undefined) {
    updateParams.archived = options.archived;
  }

  return client.pages.update(updateParams);
}

/**
 * Update page content with markdown
 */
export async function updatePageMarkdown(
  pageId: string,
  content: string,
  mode: "replace" | "append" = "replace"
): Promise<UpdatePageMarkdownResponse> {
  const client = getClient();

  if (mode === "replace") {
    return client.pages.updateMarkdown({
      page_id: pageId,
      type: "replace_content",
      replace_content: { new_str: content },
    });
  }

  return client.pages.updateMarkdown({
    page_id: pageId,
    type: "insert_content",
    insert_content: { content },
  });
}

/**
 * Move a page to a new parent
 */
export async function movePage(
  pageId: string,
  parentId: string,
  isDatabase: boolean = false
): Promise<MovePageResponse> {
  const client = getClient();

  const parent = isDatabase
    ? { data_source_id: parentId }
    : { page_id: parentId };

  return client.pages.move({
    page_id: pageId,
    parent,
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
 * Query a database (data source)
 */
export async function queryDatabase(
  databaseId: string,
  options: {
    filter?: Record<string, unknown>;
    sorts?: Array<Record<string, unknown>>;
    pageSize?: number;
    startCursor?: string;
  } = {}
): Promise<QueryDataSourceResponse> {
  const client = getClient();

  const queryParams: Parameters<typeof client.dataSources.query>[0] = {
    data_source_id: databaseId,
    page_size: options.pageSize || 100,
  };

  if (options.filter) {
    queryParams.filter = options.filter as any;
  }

  if (options.sorts) {
    queryParams.sorts = options.sorts as any;
  }

  if (options.startCursor) {
    queryParams.start_cursor = options.startCursor;
  }

  return client.dataSources.query(queryParams);
}

/**
 * Create a comment on a page
 */
export async function createComment(
  pageId: string,
  text: string
): Promise<CreateCommentResponse> {
  const client = getClient();
  return client.comments.create({
    parent: { page_id: pageId },
    rich_text: [
      {
        text: { content: text },
      },
    ],
  });
}

/**
 * List comments on a page
 */
export async function listComments(
  blockId: string,
  options: { pageSize?: number; startCursor?: string } = {}
): Promise<ListCommentsResponse> {
  const client = getClient();
  return client.comments.list({
    block_id: blockId,
    page_size: options.pageSize || 100,
    start_cursor: options.startCursor,
  });
}

/**
 * Extract simple property values from page
 */
export function extractSimpleProperties(
  page: PageObjectResponse
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, prop] of Object.entries(page.properties)) {
    if ("title" in prop) continue;

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

  // For databases / data sources
  if ("title" in result) {
    const titleArray = result.title;
    if (Array.isArray(titleArray)) {
      return titleArray.map((t) => t.plain_text).join("") || "Untitled";
    }
  }

  return "Untitled";
}

/**
 * Extract child page and linked page IDs from blocks
 */
export function extractChildPageIds(
  blocks: BlockObjectResponse[]
): string[] {
  const ids: string[] = [];

  for (const block of blocks) {
    // child_page blocks: the block ID is the page ID
    if (block.type === "child_page") {
      ids.push(block.id);
    }

    // link_to_page blocks: extract the referenced page_id
    if (block.type === "link_to_page") {
      const data = (block as any).link_to_page;
      if (data?.page_id) {
        ids.push(data.page_id);
      }
    }

    // Recurse into children
    const extended = block as BlockObjectResponse & { children?: BlockObjectResponse[] };
    if (extended.children) {
      ids.push(...extractChildPageIds(extended.children));
    }
  }

  return ids;
}

export { Client };
