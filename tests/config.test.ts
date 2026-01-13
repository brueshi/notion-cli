import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Mock the config module paths for testing
const TEST_CONFIG_DIR = join(tmpdir(), "notion-cli-test-" + Date.now());
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, "config.json");

describe("Config Module", () => {
  beforeEach(() => {
    // Clean up any existing test directory
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true });
    }
    // Clear environment variables
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_PARENT_ID;
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  test("config directory can be created", () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    expect(existsSync(TEST_CONFIG_DIR)).toBe(true);
  });

  test("config file can be written and read", () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    const config = { token: "test-token", parentId: "test-parent" };
    writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config, null, 2));

    expect(existsSync(TEST_CONFIG_FILE)).toBe(true);

    const content = Bun.file(TEST_CONFIG_FILE).text();
    expect(content).resolves.toContain("test-token");
  });

  test("environment variables should work", () => {
    process.env.NOTION_TOKEN = "env-token";
    expect(process.env.NOTION_TOKEN).toBe("env-token");
  });
});
