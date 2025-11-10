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

    // Any module with no connections?
    if (metrics.modulesWithNoConnections.length > 0) {
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
    resolveAttachment?: (id: string) => Promise<string | null>,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<RefinementPipelineResult> {
    const startTime = Date.now();
    console.log("🚀 [Requirements Extraction] Starting with gpt-4o-mini");
    
    let lastProgressTime = Date.now();
    
    if (onProgress) {
      onProgress(25, "Sunny is extracting requirements from conversation...");
      console.log(`⏱️  [Progress] 25% at ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    }
    
    // 1) First pass with mini model (this is the slow part - most time spent here)
    // Set up interval to show progress during extraction
    let currentExtractProgress = 25;
    const progressMessages = [
      "Sunny is analyzing conversation context...",
      "Sunny is identifying key features...",
      "Sunny is mapping system components...",
      "Sunny is extracting business rules...",
      "Sunny is structuring requirements...",
      "Sunny is capturing user needs...",
      "Sunny is finalizing extraction..."
    ];
    let messageIndex = 0;
    
    // Show progress every 5 seconds during extraction (should take ~40-50s)
    const progressInterval = setInterval(() => {
      if (currentExtractProgress < 55) {
        currentExtractProgress = Math.min(55, currentExtractProgress + 5);
        const message = progressMessages[messageIndex % progressMessages.length];
        if (onProgress) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          const delta = ((Date.now() - lastProgressTime) / 1000).toFixed(2);
          onProgress(currentExtractProgress, message);
          console.log(`⏱️  [Progress] ${currentExtractProgress}% at ${elapsed}s (Δ${delta}s)`);
          lastProgressTime = Date.now();
        }
        messageIndex++;
      }
    }, 5000); // Update every 5 seconds to better match actual extraction time
    
    const extractionStartTime = Date.now();
    const baseSummary = await this.extractor.extractFromTranscript(
      history,
      resolveAttachment
    );
    const extractionDuration = Date.now() - extractionStartTime;
    console.log(`⏱️  [Timing] Extraction took ${(extractionDuration / 1000).toFixed(2)}s`);
    
    // Clear the progress interval
    clearInterval(progressInterval);

    if (onProgress) {
      onProgress(60, "Sunny is analyzing requirements quality...");
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const delta = ((Date.now() - lastProgressTime) / 1000).toFixed(2);
      console.log(`⏱️  [Progress] 60% at ${elapsed}s (Δ${delta}s)`);
      lastProgressTime = Date.now();
    }
    
    // Add small delay to let progress animation catch up
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2) Generate metrics
    const metricsStartTime = Date.now();
    const metrics = this.docs.analyzeMermaidRelationships(baseSummary);
    const metricsDuration = Date.now() - metricsStartTime;
    console.log(`⏱️  [Timing] Metrics analysis took ${(metricsDuration / 1000).toFixed(2)}s`);
    console.log("📊 [Requirements Analysis] Diagram relationship analysis complete");
    
    if (onProgress) {
      onProgress(65, "Sunny is checking relationships...");
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const delta = ((Date.now() - lastProgressTime) / 1000).toFixed(2);
      console.log(`⏱️  [Progress] 65% at ${elapsed}s (Δ${delta}s)`);
      lastProgressTime = Date.now();
    }
    
    if (metrics.actorsWithNoConnections.length > 0) {
      console.log(`⚠️  [Requirements] ${metrics.actorsWithNoConnections.length} actors with no connections: ${metrics.actorsWithNoConnections.join(', ')}`);
    }
    if (metrics.modulesWithNoConnections.length > 0) {
      console.log(`⚠️  [Requirements] ${metrics.modulesWithNoConnections.length} modules with no connections: ${metrics.modulesWithNoConnections.join(', ')}`);
    }
    if (metrics.keyModulesMissingOrOrphaned.length > 0) {
      console.log(`⚠️  [Requirements] ${metrics.keyModulesMissingOrOrphaned.length} key modules orphaned: ${metrics.keyModulesMissingOrOrphaned.join(', ')}`);
    }
    if (metrics.suspiciousClientEdges.length > 0) {
      console.log(`⚠️  [Requirements] ${metrics.suspiciousClientEdges.length} suspicious client connections detected`);
    }

    // Add delay to let progress catch up
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3) Decide if refinement is needed
    let finalSummary = baseSummary;
    let wasRefined = false;

    if (this.needsRefinement(metrics)) {
      console.log("🔄 [Requirements Refinement] Issues detected, refining with gpt-4o");
      if (onProgress) {
        onProgress(70, "Sunny is refining requirements for quality...");
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const delta = ((Date.now() - lastProgressTime) / 1000).toFixed(2);
        console.log(`⏱️  [Progress] 70% at ${elapsed}s (Δ${delta}s)`);
        lastProgressTime = Date.now();
      }
      
      const refinementStartTime = Date.now();
      const transcript = this.buildTranscript(history);
      finalSummary = await this.refineRequirements(transcript, baseSummary, metrics);
      const refinementDuration = Date.now() - refinementStartTime;
      console.log(`⏱️  [Timing] Refinement took ${(refinementDuration / 1000).toFixed(2)}s`);
      wasRefined = true;
      
      if (onProgress) {
        onProgress(80, "Sunny is verifying improvements...");
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const delta = ((Date.now() - lastProgressTime) / 1000).toFixed(2);
        console.log(`⏱️  [Progress] 80% at ${elapsed}s (Δ${delta}s)`);
        lastProgressTime = Date.now();
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Re-analyze to show improvement
      const refinedMetrics = this.docs.analyzeMermaidRelationships(finalSummary);
      const issuesFixed = (
        (metrics.actorsWithNoConnections.length - refinedMetrics.actorsWithNoConnections.length) +
        (metrics.modulesWithNoConnections.length - refinedMetrics.modulesWithNoConnections.length) +
        (metrics.keyModulesMissingOrOrphaned.length - refinedMetrics.keyModulesMissingOrOrphaned.length)
      );
      console.log(`✅ [Requirements Refinement] Complete. Fixed ${issuesFixed} relationship issues`);
      
      if (onProgress) {
        onProgress(85, "Sunny is preparing workflow diagrams...");
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const delta = ((Date.now() - lastProgressTime) / 1000).toFixed(2);
        console.log(`⏱️  [Progress] 85% at ${elapsed}s (Δ${delta}s)`);
        lastProgressTime = Date.now();
      }
      await new Promise(resolve => setTimeout(resolve, 800));
    } else {
      console.log("✅ [Requirements Extraction] No issues detected, using gpt-4o-mini result");
      if (onProgress) {
        onProgress(75, "Sunny is preparing workflow diagrams...");
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const delta = ((Date.now() - lastProgressTime) / 1000).toFixed(2);
        console.log(`⏱️  [Progress] 75% at ${elapsed}s (Δ${delta}s)`);
        lastProgressTime = Date.now();
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (onProgress) {
      onProgress(90, "Sunny is generating documentation...");
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const delta = ((Date.now() - lastProgressTime) / 1000).toFixed(2);
      console.log(`⏱️  [Progress] 90% at ${elapsed}s (Δ${delta}s)`);
      lastProgressTime = Date.now();
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4) Generate final documents
    const docsStartTime = Date.now();
    const markdown = this.docs.generateRequirementsMarkdown(finalSummary);
    const mermaid = this.docs.generateMermaidFlow(finalSummary);
    const docsDuration = Date.now() - docsStartTime;
    console.log(`⏱️  [Timing] Document generation took ${(docsDuration / 1000).toFixed(2)}s`);
    
    const totalDuration = Date.now() - startTime;
    console.log(`⏱️  [Timing] Total pipeline took ${(totalDuration / 1000).toFixed(2)}s`);

    return {
      requirements: finalSummary,
      markdown,
      mermaid,
      wasRefined,
      metrics,
    };
  }
}

