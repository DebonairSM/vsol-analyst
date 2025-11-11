import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources";
import { registerTools } from "./tools";

/**
 * Initialize and start the MCP server for Sunny
 */
export async function startMCPServer() {
  // Create MCP server instance
  const server = new Server(
    {
      name: "sunny-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // Register resource handlers
  registerResources(server);

  // Register tool handlers
  registerTools(server);

  // Error handler
  server.onerror = (error) => {
    console.error("[MCP Server Error]", error);
  };

  // Set up stdio transport for Cursor integration
  const transport = new StdioServerTransport();
  
  // Connect server to transport
  await server.connect(transport);

  // Don't use console.log here - stdio is used for MCP JSON communication
  // Any non-JSON output will break the protocol
  console.error("Sunny MCP server running on stdio"); // stderr is safe

  return server;
}

/**
 * Run MCP server as standalone process
 * This is called when running the MCP server separately from the Express server
 */
export async function runStandaloneMCPServer() {
  try {
    await startMCPServer();
    
    // Keep the process running
    process.on("SIGINT", () => {
      console.log("\nShutting down Sunny MCP server...");
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

// If this file is run directly, start the standalone MCP server
if (require.main === module) {
  runStandaloneMCPServer();
}

