#!/usr/bin/env node

/**
 * HTTP-based Sunny MCP Server
 * 
 * This version calls the dev server's REST API instead of accessing the database directly.
 * This avoids SQLite database locking issues when both the dev server and MCP server
 * run simultaneously.
 * 
 * Usage:
 *   MCP_API_KEY=your-key-here tsx src/mcp/server-http.ts
 * 
 * Or in Cursor's MCP settings:
 * {
 *   "sunny": {
 *     "command": "node",
 *     "args": ["C:\\git\\vsol-analyst\\dist\\mcp\\server-http.js"],
 *     "env": {
 *       "MCP_API_KEY": "your-secret-key-here",
 *       "API_BASE_URL": "http://localhost:5051"
 *     }
 *   }
 * }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { listToolsHandler, callToolHandler } from "./tools-http.js";

// Resources are not implemented in HTTP mode since they require direct database access
// Users should use the tools instead

const server = new Server(
  {
    name: "sunny",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      // Resources disabled in HTTP mode
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, callToolHandler);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sunny MCP Server (HTTP mode) running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in MCP server:", error);
  process.exit(1);
});

