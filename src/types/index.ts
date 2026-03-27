import type {
  PageObjectResponse,
  DatabaseObjectResponse,
  DataSourceObjectResponse,
  BlockObjectResponse,
  SearchResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
  CreatePageResponse,
  GetPageMarkdownResponse,
  UpdatePageMarkdownResponse,
  MovePageResponse,
  QueryDataSourceResponse,
  CommentObjectResponse,
  CreateCommentResponse,
  ListCommentsResponse,
} from "@notionhq/client/build/src/api-endpoints";

// Re-export Notion SDK types
export type {
  PageObjectResponse,
  DatabaseObjectResponse,
  DataSourceObjectResponse,
  BlockObjectResponse,
  SearchResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
  CreatePageResponse,
  GetPageMarkdownResponse,
  UpdatePageMarkdownResponse,
  MovePageResponse,
  QueryDataSourceResponse,
  CommentObjectResponse,
  CreateCommentResponse,
  ListCommentsResponse,
};

// Config types
export interface NotionConfig {
  token: string;
  parentId?: string;
}

// CLI Output formats
export type OutputFormat = "json" | "markdown" | "xml";

// Search options
export interface SearchOptions {
  limit?: number;
  format?: OutputFormat;
  pages?: boolean;
  databases?: boolean;
}

// Page get options
export interface PageGetOptions {
  format?: OutputFormat;
  depth?: number;
}

// Page create options
export interface PageCreateOptions {
  parent?: string;
  file?: string;
  stdin?: boolean;
  standalone?: boolean;
}

// Page update options
export interface PageUpdateOptions {
  title?: string;
  file?: string;
  stdin?: boolean;
}

// Page move options
export interface PageMoveOptions {
  to: string;
}

// Context options
export interface ContextOptions {
  format?: "xml" | "markdown";
  maxTokens?: number;
}

// Database query options
export interface DbQueryOptions {
  filter?: string;
  sort?: string;
  limit?: number;
  format?: OutputFormat;
}

// Comment options
export interface CommentAddOptions {
  // no additional options needed
}

export interface CommentListOptions {
  format?: OutputFormat;
}

// Simplified search result for output
export interface SearchResult {
  id: string;
  type: "page" | "database";
  title: string;
  url: string;
  lastEdited: string;
}

// Simplified page content for output
export interface PageContent {
  id: string;
  title: string;
  url: string;
  lastEdited: string;
  properties: Record<string, unknown>;
  blocks: BlockContent[];
}

// Simplified block content
export interface BlockContent {
  id: string;
  type: string;
  content: string;
  children?: BlockContent[];
}
