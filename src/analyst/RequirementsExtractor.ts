import { LLMProvider, ChatMessage } from "../llm/LLMProvider";
import { SYSTEM_PROMPT_EXTRACTOR } from "./prompts";
import { RequirementsSummary } from "./RequirementsTypes";

export class RequirementsExtractor {
  constructor(private llm: LLMProvider) {}

  async extractFromTranscript(
    history: ChatMessage[],
    resolveAttachment?: (id: string) => Promise<string | null>
  ): Promise<RequirementsSummary> {
    // Build a transcript from the history, handling multimodal content
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
    
    const transcript = transcriptParts.join("\n\n");

    // For extraction, we'll include images in the context for vision analysis
    const extractionMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT_EXTRACTOR },
    ];

    // If there are images in the history, include them in the extraction
    const hasImages = history.some(msg => 
      Array.isArray(msg.content) && 
      msg.content.some(part => part.type === "image_url")
    );

    if (hasImages && resolveAttachment) {
      // Include the full multimodal history for vision context
      extractionMessages.push({
        role: "user",
        content: `Please analyze the following conversation and any images to extract software requirements. Pay special attention to any UI mockups, diagrams, or wireframes in the images.\n\n${transcript}`,
      });
    } else {
      // No images, just use the transcript
      extractionMessages.push({
        role: "user",
        content: transcript,
      });
    }

    const json = await this.llm.chat({
      messages: extractionMessages,
      responseFormat: "json",
      resolveAttachment,
    });

    return JSON.parse(json) as RequirementsSummary;
  }
}

