# Notion CLI — Command Reference

> For AI agents and tool integrations. All commands use `notion-cli` or `bun run src/index.ts` as the entry point.

## Setup

```bash
# Set API token
notion config --token <NOTION_API_TOKEN>

# Optionally set a default parent page for new pages
notion config --parent <PAGE_ID>

# View current config
notion config --show
```

Environment variables `NOTION_TOKEN` and `NOTION_PARENT_ID` override file config.

---

## Commands

### `search <query>`

Search pages and databases in the workspace.

```bash
notion search "meeting notes"
notion search "Q4 report" --pages --limit 5
notion search "tasks" --databases --format json
```

| Flag | Description | Default |
|------|-------------|---------|
| `-l, --limit <n>` | Maximum results | `10` |
| `-f, --format <fmt>` | `json`, `markdown`, `xml` | `markdown` |
| `-p, --pages` | Filter to pages only | |
| `-d, --databases` | Filter to databases only | |

**Output fields:** `id`, `type`, `title`, `url`, `lastEdited`

---

### `page get <page-id>`

Retrieve a page's content. Accepts page IDs or full Notion URLs.

```bash
notion page get abc123def456
notion page get https://notion.so/My-Page-abc123def456
notion page get <id> --format json
notion page get <id> --format xml --depth 2
```

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format <fmt>` | `json`, `markdown`, `xml` | `markdown` |
| `-D, --depth <n>` | Maximum block recursion depth | unlimited |

**Markdown output** includes a title heading and URL. **JSON/XML output** includes full metadata (id, title, url, lastEdited, properties, blocks).

---

### `page create <title>`

Create a new page. Omit `--parent` to create a standalone workspace-level page.

```bash
# Standalone page
notion page create "My New Page"

# Subpage under a parent
notion page create "Child Page" --parent <parent-id>

# With markdown content from file
notion page create "Design Doc" --file ./design.md

# With content from stdin
echo "# Hello" | notion page create "Quick Note" --stdin
```

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --parent <id>` | Parent page or database ID | standalone (workspace-level) |
| `-f, --file <path>` | Read markdown content from file | |
| `--stdin` | Read markdown content from stdin | |

**Output:** page ID and URL.

---

### `page update <page-id>`

Update a page's title or replace its content with markdown.

```bash
notion page update <id> --title "New Title"
notion page update <id> --file ./updated-content.md
notion page update <id> --title "Renamed" --file ./content.md
cat new-content.md | notion page update <id> --stdin
```

| Flag | Description |
|------|-------------|
| `-t, --title <title>` | New page title |
| `-f, --file <path>` | Replace content from markdown file |
| `--stdin` | Replace content from stdin |

At least one of `--title`, `--file`, or `--stdin` is required.

---

### `page move <page-id>`

Move a page to a new parent.

```bash
notion page move <page-id> --to <new-parent-id>
notion page move <page-id> --to <database-id> --database
```

| Flag | Description |
|------|-------------|
| `--to <id>` | Target parent page or database ID (required) |
| `-d, --database` | Target parent is a database |

---

### `page delete <page-id>`

Archive (soft-delete) a page. This is reversible in Notion.

```bash
notion page delete <page-id>
```

---

### `context <page-id>`

Extract page content optimized for AI context windows. Richer than `page get` — includes metadata, properties, and optional comments/child pages.

```bash
# XML context (default, token-efficient)
notion context <page-id>

# Markdown context with metadata header
notion context <page-id> -f markdown

# Full context with comments and child pages
notion context <page-id> -c -C

# Truncated to fit token budget
notion context <page-id> -t 4000 -c -C
```

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format <fmt>` | `xml`, `markdown` | `xml` |
| `-t, --max-tokens <n>` | Approximate token limit (truncates output) | unlimited |
| `-c, --include-comments` | Include page comments | off |
| `-C, --include-children` | Include content of child/linked subpages | off |

**Markdown output** includes: title, ID, URL, last edited, all properties, content, then optionally comments and child page content separated by `---`.

**XML output** structure:
```xml
<notion_context id="..." title="..." url="..." edited="...">
  <props key="value" ... />
  <content>
    <h1>...</h1>
    <p>...</p>
  </content>
  <comments count="N">
    <comment created="...">text</comment>
  </comments>
  <children>
    <child_page id="..." title="..." edited="...">
      <p>...</p>
    </child_page>
  </children>
</notion_context>
```

---

### `db query <database-id>`

Query a Notion database with optional filters and sorts.

```bash
# All rows
notion db query <database-id>

# With filter
notion db query <id> --filter '{"property":"Status","select":{"equals":"Done"}}'

# With sort
notion db query <id> --sort '{"property":"Created","direction":"descending"}'

# Combined
notion db query <id> \
  --filter '{"property":"Priority","select":{"equals":"High"}}' \
  --sort '{"property":"Due","direction":"ascending"}' \
  --limit 20 \
  --format json
```

| Flag | Description | Default |
|------|-------------|---------|
| `-F, --filter <json>` | Notion filter object as JSON | |
| `-s, --sort <json>` | Sort object or array of sort objects as JSON | |
| `-l, --limit <n>` | Maximum results | `100` |
| `-f, --format <fmt>` | `json`, `markdown`, `xml` | `markdown` |

**Output fields per row:** `id`, `title`, `url`, `lastEdited`, `properties`

---

### `comment add <page-id> <text>`

Add a comment to a page.

```bash
notion comment add <page-id> "This needs review"
```

**Output:** comment ID.

---

### `comment list <page-id>`

List comments on a page.

```bash
notion comment list <page-id>
notion comment list <page-id> --format json
```

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format <fmt>` | `json`, `markdown`, `xml` | `markdown` |

---

### `config`

Manage CLI configuration (token and default parent page).

```bash
notion config --token ntn_xxxxxxxxxxxxx
notion config --parent <page-id>
notion config --show
```

| Flag | Description |
|------|-------------|
| `-t, --token <token>` | Set Notion API token |
| `-p, --parent <id>` | Set default parent page ID |
| `-s, --show` | Display current config (token is masked) |

Config file location: `~/.config/notion-cli/config.json`

---

## Page ID Formats

All commands accepting `<page-id>` support:

- Raw 32-character hex: `abc123def456abc123def456abc123de`
- UUID with dashes: `abc123de-f456-abc1-23de-f456abc123de`
- Full Notion URL: `https://notion.so/workspace/Page-Title-abc123def456abc123def456abc123de`
- Notion site URL: `https://mysite.notion.site/Page-abc123def456abc123def456abc123de`

---

## Output Formats

All commands with `--format` support three modes:

| Format | Best for | Description |
|--------|----------|-------------|
| `markdown` | Human reading, piping to files | Readable text with markdown formatting |
| `json` | Programmatic consumption, jq | Structured data with full metadata |
| `xml` | AI context windows, token efficiency | Compact structured format |

---

## Composability Examples

```bash
# Search and get first result's content
notion search "standup" --pages --format json | jq -r '.[0].id' | xargs notion page get

# Create a page from another page's content
notion page get <source-id> --format markdown | notion page create "Copy of Page" --stdin

# Query a database and pipe to a file
notion db query <db-id> --format json > tasks.json

# Get full context for AI processing
notion context <page-id> -f markdown -c -C -t 8000 > context.md

# Add a comment after updating
notion page update <id> --file ./changes.md && notion comment add <id> "Updated via CLI"
```
