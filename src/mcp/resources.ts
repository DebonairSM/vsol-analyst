import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  fetchProject,
  fetchRequirements,
  fetchDiagrams,
  fetchSeedData,
  formatUserStoriesAsMarkdown,
} from "./db-helpers";

/**
 * Register resource handlers with the MCP server
 */
export function registerResources(server: Server) {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    // For now, we return a static list. In a more advanced implementation,
    // we could dynamically list all projects
    return {
      resources: [
        {
          uri: "sunny://projects",
          mimeType: "text/plain",
          name: "List all projects",
          description: "Get a list of all available projects in Sunny",
        },
      ],
    };
  });

  // Read a specific resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    // Parse the URI to determine what resource to fetch
    if (uri === "sunny://projects") {
      // This is handled by a tool instead
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: "Use the list_projects tool to get project information.",
          },
        ],
      };
    }

    // Parse project-specific resources: sunny://project/{projectId}/{resource}
    const projectMatch = uri.match(/^sunny:\/\/project\/([^\/]+)\/(.+)$/);
    if (!projectMatch) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    const [, projectId, resourceType] = projectMatch;

    // Verify project exists
    const project = await fetchProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    switch (resourceType) {
      case "requirements": {
        const requirements = await fetchRequirements(projectId);
        if (!requirements || !requirements.hasData) {
          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: `# Requirements for ${project.name}\n\nNo requirements have been extracted yet. Use the Sunny web interface to extract requirements first.`,
              },
            ],
          };
        }

        return {
          contents: [
            {
              uri,
              mimeType: "text/markdown",
              text: requirements.markdown,
            },
          ],
        };
      }

      case "workflow-diagram": {
        const diagrams = await fetchDiagrams(projectId);
        if (!diagrams || !diagrams.hasWorkflow) {
          return {
            contents: [
              {
                uri,
                mimeType: "text/plain",
                text: "No workflow diagram available for this project.",
              },
            ],
          };
        }

        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: diagrams.workflowDiagram,
            },
          ],
        };
      }

      case "flowchart": {
        const diagrams = await fetchDiagrams(projectId);
        if (!diagrams || !diagrams.hasFlowchart) {
          return {
            contents: [
              {
                uri,
                mimeType: "text/plain",
                text: "No detailed flowchart available for this project.",
              },
            ],
          };
        }

        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: diagrams.detailedFlowchart,
            },
          ],
        };
      }

      case "seed-data": {
        const seedData = await fetchSeedData(projectId);
        if (!seedData || !seedData.hasData) {
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                  { message: "No seed data available for this project." },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text:
                typeof seedData.data === "string"
                  ? seedData.data
                  : JSON.stringify(seedData.data, null, 2),
            },
          ],
        };
      }

      case "user-stories": {
        const markdown = await formatUserStoriesAsMarkdown(projectId);
        return {
          contents: [
            {
              uri,
              mimeType: "text/markdown",
              text: markdown,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  });
}

