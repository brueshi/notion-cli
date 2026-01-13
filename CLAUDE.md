# Notion CLI

Fast, composable command line interface for Notion.

## Quick Commands

```bash
# Run CLI
bun run src/index.ts <command>

# Run tests
bun test

# Type check
bun run typecheck
```

## Project Structure

```
src/
  index.ts              # CLI entry point
  commands/
    search.ts           # Search command
    config.ts           # Config management
    context.ts          # AI context extraction
    page/
      get.ts            # Page retrieval
      create.ts         # Page creation
      index.ts          # Page command group
  lib/
    client.ts           # Notion SDK wrapper
    config.ts           # Config file management
    transformer.ts      # XML/Markdown transforms
    errors.ts           # Error handling utilities
  types/
    index.ts            # TypeScript types

zig/                    # Zig performance binary (optional)
completions/            # Shell completions (bash, zsh, fish)
tests/                  # Bun test files
```

## Key Dependencies

- `@notionhq/client` - Official Notion SDK
- `@tryfabric/martian` - Markdown to Notion blocks
- `notion-to-md` - Notion blocks to Markdown
- `commander` - CLI argument parsing

## Configuration

Config stored at `~/.config/notion-cli/config.json` or via environment:

- `NOTION_TOKEN` - API integration token
- `NOTION_PARENT_ID` - Default parent page ID
