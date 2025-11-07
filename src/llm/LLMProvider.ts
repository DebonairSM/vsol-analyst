export type MessageContent = 
  | string 
  | Array<{type: "text"; text: string} | {type: "image_url"; image_url: {url: string}}>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

export interface LLMProvider {
  chat(opts: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    responseFormat?: "json" | "text";
    resolveAttachment?: (id: string) => Promise<string | null>;
  }): Promise<string>;
}

