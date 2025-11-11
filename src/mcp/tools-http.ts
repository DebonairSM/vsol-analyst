/**
 * HTTP-based MCP tools that call the dev server API instead of accessing the database directly
 * This avoids SQLite database locking issues when both processes run simultaneously
 */

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5051";
const API_KEY = process.env.MCP_API_KEY;

if (!API_KEY) {
  throw new Error("MCP_API_KEY environment variable is required");
}

/**
 * Helper to make authenticated API calls
 */
async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({ error: response.statusText }));
    throw new McpError(
      ErrorCode.InternalError,
      `API call failed: ${error.error || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Tool definitions
 */
export const listToolsHandler = () => {
  return {
    tools: [
      {
        name: "list_projects",
        description:
          "List all projects in Sunny with metadata about available data",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_user_stories",
        description:
          "Get all user stories for a project, grouped by epic. Returns detailed story information including status, priority, effort, and acceptance criteria.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The ID of the project",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "get_requirements",
        description: "Get the requirements document for a project in markdown format",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The ID of the project",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "get_diagrams",
        description:
          "Get workflow and flowchart diagrams for a project in Mermaid format",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The ID of the project",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "get_seed_data",
        description: "Get seed data for a project (JSON, SQL, or CSV format)",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The ID of the project",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "update_user_story",
        description:
          "Update a user story. Can update status, priority, effort, title, actor, action, benefit, or acceptance criteria.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The ID of the project",
            },
            storyId: {
              type: "string",
              description: "The ID of the user story to update",
            },
            title: {
              type: "string",
              description: "The new title for the story",
            },
            actor: {
              type: "string",
              description: "The new actor for the story",
            },
            action: {
              type: "string",
              description: "The new action for the story",
            },
            benefit: {
              type: "string",
              description: "The new benefit for the story",
            },
            status: {
              type: "string",
              enum: ["OPEN", "IN_PROGRESS", "READY_FOR_REVIEW", "IN_REVIEW", "DONE", "REMOVED"],
              description: "The new status for the story",
            },
            priority: {
              type: "string",
              enum: ["MUST_HAVE", "SHOULD_HAVE", "NICE_TO_HAVE"],
              description: "The new priority for the story",
            },
            effort: {
              type: "string",
              enum: ["SMALL", "MEDIUM", "LARGE"],
              description: "The new effort estimate for the story",
            },
            acceptanceCriteria: {
              type: "array",
              items: { type: "string" },
              description: "The new acceptance criteria for the story",
            },
          },
          required: ["projectId", "storyId"],
        },
      },
      {
        name: "update_user_story_status",
        description: "Quick convenience tool to update only the status of a user story",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The ID of the project",
            },
            storyId: {
              type: "string",
              description: "The ID of the user story to update",
            },
            status: {
              type: "string",
              enum: ["OPEN", "IN_PROGRESS", "READY_FOR_REVIEW", "IN_REVIEW", "DONE", "REMOVED"],
              description: "The new status for the story",
            },
          },
          required: ["projectId", "storyId", "status"],
        },
      },
    ],
  };
};

/**
 * Tool call handler
 */
export const callToolHandler = async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_projects": {
        const data = await apiCall("/api/mcp/projects");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data.projects, null, 2),
            },
          ],
        };
      }

      case "get_user_stories": {
        const { projectId } = args;
        if (!projectId) {
          throw new McpError(ErrorCode.InvalidParams, "projectId is required");
        }

        const data = await apiCall(`/api/mcp/projects/${projectId}/stories`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_requirements": {
        const { projectId } = args;
        if (!projectId) {
          throw new McpError(ErrorCode.InvalidParams, "projectId is required");
        }

        const data = await apiCall(`/api/mcp/projects/${projectId}/requirements`);
        return {
          content: [
            {
              type: "text",
              text: data.requirements,
            },
          ],
        };
      }

      case "get_diagrams": {
        const { projectId } = args;
        if (!projectId) {
          throw new McpError(ErrorCode.InvalidParams, "projectId is required");
        }

        const [workflow, flowchart] = await Promise.all([
          apiCall(`/api/mcp/projects/${projectId}/workflow-diagram`).catch(() => null),
          apiCall(`/api/mcp/projects/${projectId}/flowchart`).catch(() => null),
        ]);

        let result = "";
        if (workflow) {
          result += `# Workflow Diagram\n\n${workflow.diagram}\n\n`;
        }
        if (flowchart) {
          result += `# Detailed Flowchart\n\n${flowchart.diagram}`;
        }

        if (!result) {
          result = "No diagrams available for this project yet.";
        }

        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }

      case "get_seed_data": {
        const { projectId } = args;
        if (!projectId) {
          throw new McpError(ErrorCode.InvalidParams, "projectId is required");
        }

        const data = await apiCall(`/api/mcp/projects/${projectId}/seed-data`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data.seedData, null, 2),
            },
          ],
        };
      }

      case "update_user_story": {
        const { projectId, storyId, ...updates } = args;
        if (!projectId || !storyId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "projectId and storyId are required"
          );
        }

        const data = await apiCall(
          `/api/mcp/projects/${projectId}/stories/${storyId}`,
          {
            method: "PATCH",
            body: JSON.stringify(updates),
          }
        );

        return {
          content: [
            {
              type: "text",
              text: `User story updated successfully:\n${JSON.stringify(data.story, null, 2)}`,
            },
          ],
        };
      }

      case "update_user_story_status": {
        const { projectId, storyId, status } = args;
        if (!projectId || !storyId || !status) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "projectId, storyId, and status are required"
          );
        }

        const data = await apiCall(
          `/api/mcp/projects/${projectId}/stories/${storyId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ status }),
          }
        );

        return {
          content: [
            {
              type: "text",
              text: `Story status updated to ${status}`,
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

