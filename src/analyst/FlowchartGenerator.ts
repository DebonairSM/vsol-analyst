import type { LLMProvider } from "../llm/LLMProvider";
import type { RequirementsSummary } from "./RequirementsTypes";
import { SYSTEM_PROMPT_FLOWCHART_GENERATOR } from "./prompts";

/**
 * Generates complex Mermaid flowchart diagrams from requirements using a dedicated LLM call.
 * This class focuses on creating detailed, multi-layered workflow diagrams that show:
 * - Actor-module-tool relationships
 * - Process flows with decision points
 * - Data flows and integrations
 * - System architecture and interactions
 */
export class FlowchartGenerator {
  constructor(private llm: LLMProvider) {}

  /**
   * Generate a complex Mermaid flowchart from requirements.
   * Uses a dedicated, more capable model to create rich diagrams.
   */
  async generateFlowchart(requirements: RequirementsSummary): Promise<string> {
    const messages = [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT_FLOWCHART_GENERATOR,
      },
      {
        role: "user" as const,
        content: JSON.stringify(requirements, null, 2),
      },
    ];

    const mermaidDiagram = await this.llm.chat({
      messages,
      responseFormat: "text",
      temperature: 0.4,
    });

    // Validate that we got something back
    if (!mermaidDiagram || mermaidDiagram.trim().length === 0) {
      throw new Error("No flowchart diagram generated");
    }

    // Basic validation that it contains Mermaid syntax
    const cleanedDiagram = mermaidDiagram.trim();
    if (!cleanedDiagram.includes("flowchart") && !cleanedDiagram.includes("graph")) {
      throw new Error("Generated output does not appear to be a valid Mermaid diagram");
    }

    return cleanedDiagram;
  }

  /**
   * Wrap the Mermaid diagram in markdown code fences for display.
   */
  wrapInMarkdown(mermaidDiagram: string): string {
    // Remove existing code fences if present
    let cleaned = mermaidDiagram.trim();
    if (cleaned.startsWith("```mermaid")) {
      cleaned = cleaned.replace(/^```mermaid\n/, "").replace(/\n```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
    }

    return "```mermaid\n" + cleaned.trim() + "\n```";
  }
}

