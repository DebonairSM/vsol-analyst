import { LLMProvider, ChatMessage } from "../llm/LLMProvider";
import { SYSTEM_PROMPT_EXTRACTOR } from "./prompts";
import { RequirementsSummary } from "./RequirementsTypes";

export class RequirementsExtractor {
  constructor(private llm: LLMProvider) {}

  async extractFromTranscript(transcript: string): Promise<RequirementsSummary> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT_EXTRACTOR },
      { role: "user", content: transcript },
    ];

    const json = await this.llm.chat({
      messages,
      responseFormat: "json",
    });

    return JSON.parse(json) as RequirementsSummary;
  }
}

