import OpenAI from "openai";
import { ChatMessage, LLMProvider, MessageContent } from "./LLMProvider";
import fs from "fs";
import path from "path";

export class OpenAILLMProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(opts?: { apiKey?: string; defaultModel?: string }) {
    this.client = new OpenAI({
      apiKey: opts?.apiKey ?? process.env.OPENAI_API_KEY,
    });
    this.defaultModel = opts?.defaultModel ?? "gpt-4o-mini";
  }

  private hasImages(messages: ChatMessage[]): boolean {
    return messages.some(msg => 
      Array.isArray(msg.content) && 
      msg.content.some(part => part.type === "image_url")
    );
  }

  private fileToBase64DataUrl(filePath: string): string {
    const absolutePath = path.resolve(filePath);
    const fileBuffer = fs.readFileSync(absolutePath);
    const base64 = fileBuffer.toString("base64");
    
    // Determine MIME type from extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const mimeType = mimeTypes[ext] || "image/png";
    
    return `data:${mimeType};base64,${base64}`;
  }

  private async resolveAttachmentUrls(
    content: MessageContent,
    resolveAttachment?: (id: string) => Promise<string | null>
  ): Promise<MessageContent> {
    if (typeof content === "string") {
      return content;
    }

    const resolvedParts = await Promise.all(
      content.map(async (part) => {
        if (part.type === "image_url" && part.image_url.url.startsWith("attachment://")) {
          const attachmentId = part.image_url.url.replace("attachment://", "");
          
          if (resolveAttachment) {
            const filePath = await resolveAttachment(attachmentId);
            if (filePath) {
              try {
                const dataUrl = this.fileToBase64DataUrl(filePath);
                return { type: "image_url", image_url: { url: dataUrl } };
              } catch (error) {
                console.warn(`Failed to read attachment file: ${filePath}`, error);
                // Replace with text placeholder if file can't be read
                return { type: "text", text: `[Image attachment ${attachmentId} no longer available]` };
              }
            }
          }
          
          // If no resolver or file not found, replace with text placeholder
          return { type: "text", text: `[Image attachment ${attachmentId} no longer available]` };
        }
        return part;
      })
    );

    return resolvedParts as MessageContent;
  }

  async chat(opts: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    responseFormat?: "json" | "text";
    resolveAttachment?: (id: string) => Promise<string | null>;
  }): Promise<string> {
    const hasImages = this.hasImages(opts.messages);
    
    // Use gpt-4o if images are present, otherwise use default model
    const model = opts.model ?? (hasImages ? "gpt-4o" : this.defaultModel);

    // Resolve attachment:// URLs to base64 data URLs
    const resolvedMessages = await Promise.all(
      opts.messages.map(async (msg) => ({
        ...msg,
        content: await this.resolveAttachmentUrls(msg.content, opts.resolveAttachment),
      }))
    );

    const response = await this.client.chat.completions.create({
      model,
      messages: resolvedMessages as any,
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

