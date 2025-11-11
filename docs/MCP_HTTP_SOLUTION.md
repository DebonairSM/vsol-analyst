# MCP Server HTTP Solution

## Problem

The SQLite database can only be accessed by one writer at a time. When both the dev server (`npm run dev`) and the MCP server (`npm run mcp`) run simultaneously, they both try to access the same database file (`prisma/dev.db`), causing database locking errors:

```
Error querying the database: Error code 14: Unable to open the database file
```

## Solution

Created an HTTP-based MCP server that communicates with the dev server through REST API endpoints instead of directly accessing the database. This completely eliminates the database locking issue.

## Architecture

```
┌─────────────────┐         HTTP API          ┌─────────────────┐
│  MCP Server     │────────────────────────────│   Dev Server    │
│  (server-http)  │   with API Key auth       │   (port 5051)   │
└─────────────────┘                            └─────────────────┘
                                                        │
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  SQLite DB      │
                                                │  (dev.db)       │
                                                └─────────────────┘
```

## Implementation

### 1. Created MCP API Routes (`src/routes/mcp-api.ts`)

New REST API endpoints with API key authentication:

- `GET /api/mcp/projects` - List all projects
- `GET /api/mcp/projects/:projectId/stories` - Get user stories
- `GET /api/mcp/projects/:projectId/requirements` - Get requirements
- `GET /api/mcp/projects/:projectId/workflow-diagram` - Get workflow diagram
- `GET /api/mcp/projects/:projectId/flowchart` - Get flowchart
- `GET /api/mcp/projects/:projectId/seed-data` - Get seed data
- `PATCH /api/mcp/projects/:projectId/stories/:storyId` - Update story

### 2. Created HTTP-based MCP Tools (`src/mcp/tools-http.ts`)

Refactored MCP tools to use `fetch()` instead of Prisma database queries.

### 3. Created HTTP-based MCP Server (`src/mcp/server-http.ts`)

Alternative MCP server that uses the HTTP tools.

### 4. Added Build Script

Added `mcp:http` script to `package.json`:

```json
"mcp:http": "tsx src/mcp/server-http.ts"
```

## Usage Instructions

### Step 1: Add API Key to .env

Add this to your `.env` file (generate a secure random string):

```env
MCP_API_KEY=your-secure-random-api-key-here
```

### Step 2: Start Dev Server

```bash
npm run dev
```

The dev server must be running for the HTTP-based MCP server to work.

### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### Step 4: Configure Cursor MCP Settings

Edit your Cursor MCP configuration file (Settings > Features > Model Context Protocol):

**Windows:**
```json
{
  "mcpServers": {
    "sunny": {
      "command": "node",
      "args": ["C:\\git\\vsol-analyst\\dist\\mcp\\server-http.js"],
      "env": {
        "MCP_API_KEY": "your-secure-random-api-key-here",
        "API_BASE_URL": "http://localhost:5051"
      }
    }
  }
}
```

**macOS/Linux:**
```json
{
  "mcpServers": {
    "sunny": {
      "command": "node",
      "args": ["/path/to/vsol-analyst/dist/mcp/server-http.js"],
      "env": {
        "MCP_API_KEY": "your-secure-random-api-key-here",
        "API_BASE_URL": "http://localhost:5051"
      }
    }
  }
}
```

### Step 5: Restart Cursor

Restart Cursor completely to reload the MCP server configuration.

### Step 6: Test It

You can now use both the dev server and MCP server simultaneously without conflicts:

1. Dev server is accessible at `http://localhost:5051`
2. MCP server provides tools in Cursor (e.g., "Show me all projects in Sunny")

## Benefits

1. **No Database Locking** - MCP server and dev server can run simultaneously
2. **Better Security** - API key authentication for MCP access
3. **Easier Debugging** - HTTP requests can be inspected with network tools
4. **Better Architecture** - Separation of concerns (MCP server doesn't need database access)
5. **Production Ready** - Can scale MCP servers independently from the main app

## Comparison: Direct vs HTTP

### Direct Database Access (Original)
**Pros:**
- Slightly faster (no HTTP overhead)
- Simpler setup

**Cons:**
- Cannot run with dev server (database locking)
- Requires database file access
- Harder to scale or distribute

### HTTP API (New)
**Pros:**
- Can run alongside dev server
- Better for development workflow
- More secure (API key auth)
- Easier to scale
- Can work with remote servers

**Cons:**
- Requires dev server to be running
- Slight HTTP overhead

## Troubleshooting

### Error: "MCP_API_KEY not configured"
- Make sure you added `MCP_API_KEY` to your `.env` file
- Restart the dev server after adding it

### Error: "Invalid API key"
- The MCP_API_KEY in Cursor's configuration must match the one in `.env`
- Check for typos or extra spaces

### Error: "API call failed"
- Make sure the dev server is running on port 5051
- Check if `API_BASE_URL` in MCP config is correct
- Verify dev server logs for any errors

### MCP server not responding in Cursor
- Rebuild the project: `npm run build`
- Restart Cursor completely
- Check the Cursor MCP logs for errors

