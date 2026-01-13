import { describe, test, expect } from "bun:test";
import {
  escapeXml,
  transformToXmlTypeScript,
  blocksToContent,
} from "../src/lib/transformer";
import type { PageContent, BlockContent } from "../src/types";

describe("Transformer Module", () => {
  describe("escapeXml", () => {
    test("escapes ampersand", () => {
      expect(escapeXml("foo & bar")).toBe("foo &amp; bar");
    });

    test("escapes less than", () => {
      expect(escapeXml("foo < bar")).toBe("foo &lt; bar");
    });

    test("escapes greater than", () => {
      expect(escapeXml("foo > bar")).toBe("foo &gt; bar");
    });

    test("escapes double quotes", () => {
      expect(escapeXml('foo "bar"')).toBe("foo &quot;bar&quot;");
    });

    test("escapes single quotes", () => {
      expect(escapeXml("foo 'bar'")).toBe("foo &apos;bar&apos;");
    });

    test("escapes multiple characters", () => {
      expect(escapeXml('<script>"alert(\'xss\')&"</script>')).toBe(
        "&lt;script&gt;&quot;alert(&apos;xss&apos;)&amp;&quot;&lt;/script&gt;"
      );
    });

    test("handles empty string", () => {
      expect(escapeXml("")).toBe("");
    });

    test("handles string with no special characters", () => {
      expect(escapeXml("hello world")).toBe("hello world");
    });
  });

  describe("transformToXmlTypeScript", () => {
    test("generates valid XML structure", () => {
      const pageContent: PageContent = {
        id: "test-id-123",
        title: "Test Page",
        url: "https://notion.so/test",
        lastEdited: "2025-01-10T12:00:00.000Z",
        properties: {},
        blocks: [],
      };

      const xml = transformToXmlTypeScript(pageContent);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<notion_page id="test-id-123"');
      expect(xml).toContain('title="Test Page"');
      expect(xml).toContain('edited="2025-01-10"');
      expect(xml).toContain("<content>");
      expect(xml).toContain("</content>");
      expect(xml).toContain("</notion_page>");
    });

    test("includes properties in output", () => {
      const pageContent: PageContent = {
        id: "test-id",
        title: "Test",
        url: "https://notion.so/test",
        lastEdited: "2025-01-10T12:00:00.000Z",
        properties: {
          status: "published",
          tags: "test,demo",
        },
        blocks: [],
      };

      const xml = transformToXmlTypeScript(pageContent);

      expect(xml).toContain("<props");
      expect(xml).toContain('status="published"');
      expect(xml).toContain('tags="test,demo"');
    });

    test("converts blocks to XML elements", () => {
      const pageContent: PageContent = {
        id: "test-id",
        title: "Test",
        url: "https://notion.so/test",
        lastEdited: "2025-01-10T12:00:00.000Z",
        properties: {},
        blocks: [
          { id: "b1", type: "heading_1", content: "Introduction" },
          { id: "b2", type: "paragraph", content: "Hello world" },
        ],
      };

      const xml = transformToXmlTypeScript(pageContent);

      expect(xml).toContain("<h1>Introduction</h1>");
      expect(xml).toContain("<p>Hello world</p>");
    });

    test("handles nested blocks", () => {
      const pageContent: PageContent = {
        id: "test-id",
        title: "Test",
        url: "https://notion.so/test",
        lastEdited: "2025-01-10T12:00:00.000Z",
        properties: {},
        blocks: [
          {
            id: "b1",
            type: "toggle",
            content: "Click to expand",
            children: [{ id: "b2", type: "paragraph", content: "Hidden content" }],
          },
        ],
      };

      const xml = transformToXmlTypeScript(pageContent);

      expect(xml).toContain("<toggle>Click to expand");
      expect(xml).toContain("<p>Hidden content</p>");
      expect(xml).toContain("</toggle>");
    });

    test("escapes special characters in content", () => {
      const pageContent: PageContent = {
        id: "test-id",
        title: "Test & Demo",
        url: "https://notion.so/test",
        lastEdited: "2025-01-10T12:00:00.000Z",
        properties: {},
        blocks: [{ id: "b1", type: "paragraph", content: "Use <div> tags" }],
      };

      const xml = transformToXmlTypeScript(pageContent);

      expect(xml).toContain("Test &amp; Demo");
      expect(xml).toContain("Use &lt;div&gt; tags");
    });
  });

  describe("blocksToContent", () => {
    test("converts empty array", () => {
      const result = blocksToContent([]);
      expect(result).toEqual([]);
    });

    test("converts block with rich_text", () => {
      const mockBlock = {
        id: "block-1",
        type: "paragraph",
        has_children: false,
        paragraph: {
          rich_text: [{ plain_text: "Hello " }, { plain_text: "world" }],
        },
      } as any;

      const result = blocksToContent([mockBlock]);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("block-1");
      expect(result[0]?.type).toBe("paragraph");
      expect(result[0]?.content).toBe("Hello world");
    });

    test("handles children blocks", () => {
      const mockBlock = {
        id: "parent-1",
        type: "toggle",
        has_children: true,
        toggle: {
          rich_text: [{ plain_text: "Parent" }],
        },
        children: [
          {
            id: "child-1",
            type: "paragraph",
            has_children: false,
            paragraph: {
              rich_text: [{ plain_text: "Child" }],
            },
          },
        ],
      } as any;

      const result = blocksToContent([mockBlock]);

      expect(result).toHaveLength(1);
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.content).toBe("Child");
    });
  });
});
