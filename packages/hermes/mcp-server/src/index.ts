#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createHermesMcpServer } from "./lib/create-hermes-mcp-server.js";

/**
 * Starts the Hermes MCP server on stdio (for Cursor and other MCP clients).
 */
const main = async (): Promise<void> => {
  const server = createHermesMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`hermes-mcp failed to start: ${message}`);
  process.exit(1);
});
