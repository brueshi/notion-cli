# Notion CLI

A fast, composable command line interface for Notion that enables documentation management, page search, and context extraction for AI tooling integration.

## Features

- **Search** - Search pages and databases in your Notion workspace
- **Page Operations** - Retrieve and create pages with markdown support
- **AI Context Extraction** - Optimized XML/Markdown output for AI tools (Claude Code, Cursor)
- **Multiple Output Formats** - JSON, Markdown, and XML output
- **Unix-Friendly** - Composable with pipes and shell scripting

## Installation

### Prerequisites

- [Bun](https://bun.sh) >= 1.0

### Install from npm

```bash
# Global install
bun add -g @brueshi/notion-cli

# Or use directly with bunx
bunx @brueshi/notion-cli search "query"
```

### Install from source

```bash
git clone https://github.com/brueshi/notion-cli.git
cd notion-cli
bun install
bun link  # Makes 'notion-cli' available globally
```

## Configuration

### Set up your Notion token

1. Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Copy the Internal Integration Token
3. Share your pages/databases with the integration

```bash
# Set your token
notion-cli config --token secret_xxx

# Set a default parent page for new pages
notion-cli config --parent <page-id>

# View current configuration
notion-cli config --show
```

You can also use environment variables:

```bash
export NOTION_TOKEN=secret_xxx
export NOTION_PARENT_ID=<page-id>
```

## Usage

### Search

Search for pages and databases in your workspace:

```bash
# Basic search
notion-cli search "project roadmap"

# Search with options
notion-cli search "meeting notes" --limit 20 --format json

# Filter by type
notion-cli search "database" --databases
notion-cli search "page" --pages
```

**Options:**
- `-l, --limit <n>` - Maximum results (default: 10)
- `-f, --format <fmt>` - Output format: json, markdown, xml (default: markdown)
- `-p, --pages` - Filter to pages only
- `-d, --databases` - Filter to databases only

### Page Operations

#### Get page content

```bash
# Get page as markdown
notion-cli page get <page-id>

# Get as JSON
notion-cli page get <page-id> --format json

# Get as XML (optimized for AI)
notion-cli page get <page-id> --format xml

# Limit block recursion depth
notion-cli page get <page-id> --depth 2
```

**Options:**
- `-f, --format <fmt>` - Output format: json, markdown, xml (default: markdown)
- `-D, --depth <n>` - Maximum block recursion depth

#### Create a new page

```bash
# Create with title only
notion-cli page create "My New Page" --parent <parent-id>

# Create from markdown file
notion-cli page create "Documentation" --file docs/readme.md

# Create from stdin (piping)
echo "# Hello World" | notion-cli page create "Quick Note" --stdin
```

**Options:**
- `-p, --parent <id>` - Parent page or database ID (uses default if not specified)
- `-f, --file <path>` - Read content from markdown file
- `--stdin` - Read content from stdin

### Context Extraction

Extract page content optimized for AI context windows:

```bash
# Extract as XML (default, token-efficient)
notion-cli context <page-id>

# Extract as markdown
notion-cli context <page-id> --format markdown
```

**XML Output Format:**

```xml
<notion_page id="abc123" title="Deploy Guide" edited="2025-01-10">
  <props status="published" tags="devops,aws" />
  <content>
    <h1>Prerequisites</h1>
    <p>Ensure Docker is installed.</p>
    <code lang="bash">docker --version</code>
  </content>
</notion_page>
```

**Options:**
- `-f, --format <fmt>` - Output format: xml, markdown (default: xml)
- `-t, --max-tokens <n>` - Approximate token limit for truncation

## Shell Completions

### Bash

```bash
source completions/notion.bash
# Or copy to /etc/bash_completion.d/notion
```

### Zsh

```bash
# Add to your fpath
cp completions/_notion ~/.zsh/completions/
# Then run: compinit
```

### Fish

```bash
cp completions/notion.fish ~/.config/fish/completions/
```

## Examples

### Export a page to file

```bash
notion-cli page get <page-id> --format markdown > output.md
```

### Search and get first result

```bash
notion-cli search "project" --format json | jq -r '.results[0].id' | xargs notion-cli page get
```

### Create documentation from multiple files

```bash
for file in docs/*.md; do
  title=$(basename "$file" .md)
  notion-cli page create "$title" --file "$file" --parent <parent-id>
done
```

### Feed page context to AI tools

```bash
# Copy to clipboard (macOS)
notion-cli context <page-id> | pbcopy

# Use with a command
notion-cli context <page-id> | your-ai-tool --context -
```

## Architecture

The CLI is built with:

- **Bun** - Fast TypeScript runtime with 3-4x faster startup than Node.js
- **@notionhq/client** - Official Notion SDK
- **Commander.js** - CLI argument parsing
- **@tryfabric/martian** - Markdown to Notion blocks conversion
- **notion-to-md** - Notion blocks to Markdown conversion

### Performance Targets

| Operation | Target |
|-----------|--------|
| CLI startup | <50ms |
| Search | <500ms |
| Page get (small) | <800ms |
| Context transform | <10ms |
| Page create | <1s |

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test

# Type checking
bun run typecheck
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
