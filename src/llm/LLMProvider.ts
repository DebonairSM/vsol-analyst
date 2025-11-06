export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  chat(opts: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    responseFormat?: "json" | "text";
  }): Promise<string>;
}

