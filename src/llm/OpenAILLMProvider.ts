import OpenAI from "openai";
import { ChatMessage, LLMProvider } from "./LLMProvider";

export class OpenAILLMProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(opts?: { apiKey?: string; defaultModel?: string }) {
    this.client = new OpenAI({
      apiKey: opts?.apiKey ?? process.env.OPENAI_API_KEY,
    });
    this.defaultModel = opts?.defaultModel ?? "gpt-4o-mini";
  }

  async chat(opts: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    responseFormat?: "json" | "text";
  }): Promise<string> {
    const model = opts.model ?? this.defaultModel;

    const response = await this.client.chat.completions.create({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      response_format:
        opts.responseFormat === "json"
          ? { type: "json_object" }
          : { type: "text" },
    });

    const choice = response.choices[0];
    return choice.message.content ?? "";
  }
}

