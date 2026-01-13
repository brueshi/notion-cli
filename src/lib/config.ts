import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { NotionConfig } from "../types";

const CONFIG_DIR = join(homedir(), ".config", "notion-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load configuration from file and environment variables
 * Environment variables take precedence over file config
 */
export function loadConfig(): NotionConfig | null {
  // Try environment variables first
  const envToken = process.env.NOTION_TOKEN;
  const envParentId = process.env.NOTION_PARENT_ID;

  // Try loading from config file
  let fileConfig: Partial<NotionConfig> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      const content = readFileSync(CONFIG_FILE, "utf-8");
      fileConfig = JSON.parse(content);
    } catch {
      // Invalid config file, ignore
    }
  }

  // Merge with env vars taking precedence
  const token = envToken || fileConfig.token;
  const parentId = envParentId || fileConfig.parentId;

  if (!token) {
    return null;
  }

  return {
    token,
    parentId,
  };
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Partial<NotionConfig>): void {
  ensureConfigDir();

  // Load existing config and merge
  let existingConfig: Partial<NotionConfig> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      const content = readFileSync(CONFIG_FILE, "utf-8");
      existingConfig = JSON.parse(content);
    } catch {
      // Invalid config file, start fresh
    }
  }

  const newConfig = { ...existingConfig, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
}

/**
 * Get a specific config value
 */
export function getConfigValue(key: keyof NotionConfig): string | undefined {
  const config = loadConfig();
  return config?.[key];
}

/**
 * Display current configuration (with token masked)
 */
export function showConfig(): void {
  const config = loadConfig();

  if (!config) {
    console.log("No configuration found.");
    console.log("\nSet your Notion token with:");
    console.log("  notion config --token <your-token>");
    console.log("\nOr set the NOTION_TOKEN environment variable.");
    return;
  }

  const maskedToken = config.token
    ? `${config.token.slice(0, 10)}...${config.token.slice(-4)}`
    : "not set";

  console.log("Current configuration:");
  console.log(`  Token:     ${maskedToken}`);
  console.log(`  Parent ID: ${config.parentId || "not set"}`);
  console.log(`\nConfig file: ${CONFIG_FILE}`);
}

/**
 * Validate that required configuration exists
 */
export function requireConfig(): NotionConfig {
  const config = loadConfig();

  if (!config) {
    console.error("Error: Notion token not configured.");
    console.error("\nSet your token with:");
    console.error("  notion config --token <your-token>");
    console.error("\nOr set the NOTION_TOKEN environment variable.");
    process.exit(1);
  }

  return config;
}

export { CONFIG_DIR, CONFIG_FILE };
