/**
 * Custom error classes for better error handling
 */

export class NotionCLIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = "NotionCLIError";
  }

  display(): void {
    console.error(`Error: ${this.message}`);
    if (this.hint) {
      console.error(`\nHint: ${this.hint}`);
    }
  }
}

export class ConfigurationError extends NotionCLIError {
  constructor(message: string, hint?: string) {
    super(message, "CONFIG_ERROR", hint);
    this.name = "ConfigurationError";
  }
}

export class APIError extends NotionCLIError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    hint?: string
  ) {
    super(message, "API_ERROR", hint);
    this.name = "APIError";
  }
}

export class ValidationError extends NotionCLIError {
  constructor(message: string, hint?: string) {
    super(message, "VALIDATION_ERROR", hint);
    this.name = "ValidationError";
  }
}

/**
 * Handle Notion API errors and convert to user-friendly messages
 */
export function handleNotionError(error: unknown): never {
  if (error instanceof NotionCLIError) {
    error.display();
    process.exit(1);
  }

  // Handle Notion SDK errors
  if (error && typeof error === "object" && "code" in error) {
    const notionError = error as { code: string; message?: string; status?: number };

    switch (notionError.code) {
      case "unauthorized":
        console.error("Error: Invalid or expired Notion token.");
        console.error("\nHint: Update your token with:");
        console.error("  notion config --token <your-token>");
        break;

      case "object_not_found":
        console.error("Error: Page or database not found.");
        console.error("\nHint: Check that:");
        console.error("  - The ID is correct");
        console.error("  - The page/database is shared with your integration");
        break;

      case "rate_limited":
        console.error("Error: Rate limited by Notion API.");
        console.error("\nHint: Wait a moment and try again.");
        break;

      case "validation_error":
        console.error(`Error: Invalid request - ${notionError.message || "unknown validation error"}`);
        break;

      case "conflict_error":
        console.error("Error: Conflict detected. The resource may have been modified.");
        break;

      case "internal_server_error":
        console.error("Error: Notion API internal error. Please try again later.");
        break;

      default:
        console.error(`Error: ${notionError.message || "Unknown Notion API error"}`);
    }

    process.exit(1);
  }

  // Handle generic errors
  if (error instanceof Error) {
    if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
      console.error("Error: Unable to connect to Notion API.");
      console.error("\nHint: Check your internet connection.");
      process.exit(1);
    }

    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  console.error("Error: An unexpected error occurred.");
  process.exit(1);
}

/**
 * Parse page ID from URL or raw ID
 */
export function parsePageId(input: string): string {
  // Remove URL prefix if present
  let id = input;

  // Handle full Notion URLs
  if (id.includes("notion.so") || id.includes("notion.site")) {
    // Extract the ID from URLs like:
    // https://www.notion.so/workspace/Page-Title-abc123def456
    // https://notion.so/abc123def456
    const urlMatch = id.match(/([a-f0-9]{32}|[a-f0-9-]{36})(?:\?|$)/i);
    if (urlMatch && urlMatch[1]) {
      id = urlMatch[1];
    } else {
      // Try to get the last segment
      const segments = id.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        // Extract ID from "Page-Title-abc123def456" format
        const dashMatch = lastSegment.match(/([a-f0-9]{32})$/i);
        if (dashMatch && dashMatch[1]) {
          id = dashMatch[1];
        }
      }
    }
  }

  // Remove dashes from UUID format
  id = id.replace(/-/g, "");

  // Validate the ID format (should be 32 hex characters)
  if (!/^[a-f0-9]{32}$/i.test(id)) {
    throw new ValidationError(
      "Invalid page ID format.",
      "Use a valid Notion page ID or full page URL."
    );
  }

  return id;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}
