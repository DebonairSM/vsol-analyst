import { LLMProvider, ChatMessage } from "../llm/LLMProvider";
import { RequirementsExtractor } from "./RequirementsExtractor";
import { DocumentGenerator, MermaidMetrics } from "./DocumentGenerator";
import { SYSTEM_PROMPT_REFINER } from "./prompts";
import { RequirementsSummary } from "./RequirementsTypes";

/**
 * Result of the refinement pipeline, including the final summary,
 * generated documents, and diagnostic information.
 */
export interface RefinementPipelineResult {
  requirements: RequirementsSummary;
  markdown: string;
  mermaid: string;
  wasRefined: boolean;
  metrics: MermaidMetrics;
}

/**
 * Orchestrates the two-pass requirements extraction with optional refinement.
 * 
 * Pipeline:
 * 1. First pass with gpt-4o-mini (fast, cheap)
 * 2. Generate diagnostics
 * 3. If issues detected, refine with gpt-4o (slow, expensive)
 * 4. Return final summary + documents
 */
export class RequirementsRefinementPipeline {
  constructor(
    private llmMini: LLMProvider,
    private llmFull: LLMProvider,
    private extractor: RequirementsExtractor,
    private docs: DocumentGenerator
  ) {}

  /**
   * Decide if refinement is needed based on metrics.
   */
  private needsRefinement(metrics: MermaidMetrics): boolean {
    // Any actor with no edges?
    if (metrics.actorsWithNoConnections.length > 0) {
      return true;
    }

    // Important modules should have at least one actor
    if (metrics.keyModulesMissingOrOrphaned.length > 0) {
      return true;
    }

    // Suspicious client connections?
    if (metrics.suspiciousClientEdges.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Build a condensed transcript string from chat history.
   */
  private buildTranscript(history: ChatMessage[]): string {
    const transcriptParts: string[] = [];
    
    for (const msg of history) {
      if (msg.role === "system") continue; // Skip system messages
      
      let contentText = "";
      if (typeof msg.content === "string") {
        contentText = msg.content;
      } else {
        // Multimodal content - extract text parts and note images
        const textParts = msg.content
          .filter(part => part.type === "text")
          .map(part => (part as any).text);
        const imageParts = msg.content.filter(part => part.type === "image_url");
        
        contentText = textParts.join(" ");
        if (imageParts.length > 0) {
          contentText += ` [${imageParts.length} image(s) uploaded]`;
        }
      }
      
      transcriptParts.push(`${msg.role.toUpperCase()}: ${contentText}`);
    }
    
    return transcriptParts.join("\n\n");
  }

  /**
   * Refine a RequirementsSummary using the larger model.
   */
  private async refineRequirements(
    transcript: string,
    original: RequirementsSummary,
    metrics: MermaidMetrics
  ): Promise<RequirementsSummary> {
    try {
      // Build the refinement prompt
      const userMessage = {
        transcript,
        originalRequirementsSummary: original,
        mermaidDiagnostics: metrics,
      };

      const json = await this.llmFull.chat({
        messages: [
          { role: "system", content: SYSTEM_PROMPT_REFINER },
          { 
            role: "user", 
            content: `Please return a refined RequirementsSummary JSON, adjusting only the descriptions and field contents as needed to fix the issues indicated in mermaidDiagnostics. Do not change the schema or remove any existing fields.\n\n${JSON.stringify(userMessage, null, 2)}`
          },
        ],
        responseFormat: "json",
        temperature: 0.3,
      });

      const refined = JSON.parse(json) as RequirementsSummary;
      
      // Ensure uploadedDocuments is always an array
      if (!refined.uploadedDocuments) {
        refined.uploadedDocuments = [];
      }
      
      return refined;
    } catch (error) {
      console.error("Error during refinement, falling back to original:", error);
      return original;
    }
  }

  /**
   * Run the full extraction pipeline with optional refinement.
   */
  async extractWithRefinement(
    history: ChatMessage[],
    resolveAttachment?: (id: string) => Promise<string | null>
  ): Promise<RefinementPipelineResult> {
    // 1) First pass with mini model
    const baseSummary = await this.extractor.extractFromTranscript(
      history,
      resolveAttachment
    );

    // 2) Generate metrics
    const metrics = this.docs.analyzeMermaidRelationships(baseSummary);

    // 3) Decide if refinement is needed
    let finalSummary = baseSummary;
    let wasRefined = false;

    if (this.needsRefinement(metrics)) {
      const transcript = this.buildTranscript(history);
      finalSummary = await this.refineRequirements(transcript, baseSummary, metrics);
      wasRefined = true;
    }

    // 4) Generate final documents
    const markdown = this.docs.generateRequirementsMarkdown(finalSummary);
    const mermaid = this.docs.generateMermaidFlow(finalSummary);

    return {
      requirements: finalSummary,
      markdown,
      mermaid,
      wasRefined,
      metrics,
    };
  }
}

