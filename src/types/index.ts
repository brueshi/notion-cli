import type {
  PageObjectResponse,
  DatabaseObjectResponse,
  BlockObjectResponse,
  SearchResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
} from "@notionhq/client/build/src/api-endpoints";

// Re-export Notion SDK types
export type {
  PageObjectResponse,
  DatabaseObjectResponse,
  BlockObjectResponse,
  SearchResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
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
}

// Context options
export interface ContextOptions {
  format?: "xml" | "markdown";
  maxTokens?: number;
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
