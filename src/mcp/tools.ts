import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StoryStatus, StoryPriority, StoryEffort } from "@prisma/client";
import {
  fetchAllProjects,
  fetchProject,
  fetchUserStoriesByProject,
  fetchRequirements,
  fetchDiagrams,
  fetchSeedData,
  updateUserStory,
} from "./db-helpers";
import { ToolResult } from "./types";

/**
 * Register tool handlers with the MCP server
 */
export function registerTools(server: Server) {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
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
          description:
            "Get the requirements document for a project in markdown format",
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
              status: {
                type: "string",
                enum: [
                  "OPEN",
                  "IN_PROGRESS",
                  "READY_FOR_REVIEW",
                  "IN_REVIEW",
                  "DONE",
                  "REMOVED",
                ],
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
          description:
            "Quick convenience tool to update only the status of a user story",
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
                enum: [
                  "OPEN",
                  "IN_PROGRESS",
                  "READY_FOR_REVIEW",
                  "IN_REVIEW",
                  "DONE",
                  "REMOVED",
                ],
                description: "The new status for the story",
              },
            },
            required: ["projectId", "storyId", "status"],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "list_projects": {
          const projects = await fetchAllProjects();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    data: projects,
                  } as ToolResult,
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "get_user_stories": {
          const { projectId } = args as { projectId: string };
          if (!projectId) {
            throw new Error("projectId is required");
          }

          const project = await fetchProject(projectId);
          if (!project) {
            throw new Error(`Project not found: ${projectId}`);
          }

          const epics = await fetchUserStoriesByProject(projectId);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    data: {
                      projectId,
                      projectName: project.name,
                      epics,
                      totalStories: epics.reduce(
                        (sum, epic) => sum + epic.stories.length,
                        0
                      ),
                    },
                  } as ToolResult,
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "get_requirements": {
          const { projectId } = args as { projectId: string };
          if (!projectId) {
            throw new Error("projectId is required");
          }

          const project = await fetchProject(projectId);
          if (!project) {
            throw new Error(`Project not found: ${projectId}`);
          }

          const requirements = await fetchRequirements(projectId);
          if (!requirements || !requirements.hasData) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error:
                        "No requirements have been extracted yet. Use the Sunny web interface to extract requirements first.",
                    } as ToolResult,
                    null,
                    2
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    data: {
                      projectId,
                      projectName: project.name,
                      markdown: requirements.markdown,
                      mermaidWorkflow: requirements.mermaidWorkflow,
                      extractedAt: requirements.extractedAt,
                    },
                  } as ToolResult,
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "get_diagrams": {
          const { projectId } = args as { projectId: string };
          if (!projectId) {
            throw new Error("projectId is required");
          }

          const project = await fetchProject(projectId);
          if (!project) {
            throw new Error(`Project not found: ${projectId}`);
          }

          const diagrams = await fetchDiagrams(projectId);
          if (!diagrams) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error: "No diagrams available for this project.",
                    } as ToolResult,
                    null,
                    2
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    data: {
                      projectId,
                      projectName: project.name,
                      hasWorkflow: diagrams.hasWorkflow,
                      hasFlowchart: diagrams.hasFlowchart,
                      workflowDiagram: diagrams.workflowDiagram,
                      detailedFlowchart: diagrams.detailedFlowchart,
                    },
                  } as ToolResult,
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "get_seed_data": {
          const { projectId } = args as { projectId: string };
          if (!projectId) {
            throw new Error("projectId is required");
          }

          const project = await fetchProject(projectId);
          if (!project) {
            throw new Error(`Project not found: ${projectId}`);
          }

          const seedData = await fetchSeedData(projectId);
          if (!seedData || !seedData.hasData) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error: "No seed data available for this project.",
                    } as ToolResult,
                    null,
                    2
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    data: {
                      projectId,
                      projectName: project.name,
                      format: seedData.format,
                      filename: seedData.filename,
                      data: seedData.data,
                      generatedAt: seedData.generatedAt,
                    },
                  } as ToolResult,
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "update_user_story": {
          const {
            projectId,
            storyId,
            status,
            priority,
            effort,
            title,
            actor,
            action,
            benefit,
            acceptanceCriteria,
          } = args as {
            projectId: string;
            storyId: string;
            status?: string;
            priority?: string;
            effort?: string;
            title?: string;
            actor?: string;
            action?: string;
            benefit?: string;
            acceptanceCriteria?: string[];
          };

          if (!projectId || !storyId) {
            throw new Error("projectId and storyId are required");
          }

          // Validate enum values
          if (status && !Object.values(StoryStatus).includes(status as any)) {
            throw new Error(
              `Invalid status. Must be one of: ${Object.values(StoryStatus).join(", ")}`
            );
          }
          if (
            priority &&
            !Object.values(StoryPriority).includes(priority as any)
          ) {
            throw new Error(
              `Invalid priority. Must be one of: ${Object.values(StoryPriority).join(", ")}`
            );
          }
          if (effort && !Object.values(StoryEffort).includes(effort as any)) {
            throw new Error(
              `Invalid effort. Must be one of: ${Object.values(StoryEffort).join(", ")}`
            );
          }

          const updates: any = {};
          if (status) updates.status = status as StoryStatus;
          if (priority) updates.priority = priority as StoryPriority;
          if (effort) updates.effort = effort as StoryEffort;
          if (title) updates.title = title;
          if (actor) updates.actor = actor;
          if (action) updates.action = action;
          if (benefit) updates.benefit = benefit;
          if (acceptanceCriteria) updates.acceptanceCriteria = acceptanceCriteria;

          const updatedStory = await updateUserStory(projectId, storyId, updates);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    data: updatedStory,
                  } as ToolResult,
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "update_user_story_status": {
          const { projectId, storyId, status } = args as {
            projectId: string;
            storyId: string;
            status: string;
          };

          if (!projectId || !storyId || !status) {
            throw new Error("projectId, storyId, and status are required");
          }

          if (!Object.values(StoryStatus).includes(status as any)) {
            throw new Error(
              `Invalid status. Must be one of: ${Object.values(StoryStatus).join(", ")}`
            );
          }

          const updatedStory = await updateUserStory(projectId, storyId, {
            status: status as StoryStatus,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    data: updatedStory,
                  } as ToolResult,
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: errorMessage,
              } as ToolResult,
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });
}

