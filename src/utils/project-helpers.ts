import { prisma } from "./prisma";
import { NotFoundError } from "./errors";
import { ChatMessage } from "../llm/LLMProvider";
import { SYSTEM_PROMPT_ANALYST } from "../analyst/prompts";

/**
 * Verify that a user owns a project.
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId,
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }
}

/**
 * Get or create a chat session for a project.
 */
export async function getOrCreateChatSession(
  projectId: string,
  userFirstName: string
): Promise<{ id: string; history: ChatMessage[] }> {
  let chatSession = await prisma.chatSession.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  if (!chatSession) {
    const history: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT_ANALYST(userFirstName) },
    ];
    chatSession = await prisma.chatSession.create({
      data: {
        projectId,
        history: JSON.stringify(history),
      },
    });
    return { id: chatSession.id, history };
  }

  const history = JSON.parse(chatSession.history as string) as ChatMessage[];
  return { id: chatSession.id, history };
}

/**
 * Update chat session history.
 */
export async function updateChatSessionHistory(
  sessionId: string,
  history: ChatMessage[]
): Promise<void> {
  // Remove undefined values before storing in Prisma
  const cleanHistory = history.map(msg => {
    if (typeof msg.content === 'string') {
      return msg;
    }
    // For multimodal content, filter out any undefined properties
    return {
      role: msg.role,
      content: msg.content.map(part => {
        const cleaned: any = { type: part.type };
        if ('text' in part && part.text !== undefined) {
          cleaned.text = part.text;
        }
        if ('image_url' in part && part.image_url !== undefined) {
          cleaned.image_url = part.image_url;
        }
        return cleaned;
      })
    };
  });

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { history: JSON.stringify(cleanHistory) },
  });
}

