import {
  type DiscoveryClarificationItem,
  type DiscoveryReadiness,
  EXPENSIVE_MISS_CHECKS,
  getDiscoveryModeProfile,
  normalizeDiscoveryReadiness,
  withDiscoveryReadinessContext,
} from "./DiscoveryReadiness";
import type { ChatMessage, LLMProvider } from "../llm/LLMProvider";

export const MAX_DISCOVERY_FOLLOW_UPS = 3;

export type DiscoveryConversationAction =
  | {
      type: "ask";
      itemKey: string;
      question: string;
      knownContext?: string[];
    }
  | {
      type: "resolve";
      itemKey: string;
      answer: string;
    }
  | {
      type: "park";
      itemKey: string;
      question?: string;
      knownContext?: string[];
    }
  | { type: "none" };

export interface DiscoveryConversationResult {
  readiness: DiscoveryReadiness;
  parked: boolean;
}

export interface DiscoveryChatResult {
  reply: string;
  readiness: DiscoveryReadiness;
}

export function applyDiscoveryConversationAction(
  readinessValue: unknown,
  action: DiscoveryConversationAction
): DiscoveryConversationResult {
  const readiness = normalizeDiscoveryReadiness(readinessValue);
  if (action.type === "none") {
    const exhausted = [...readiness.clarificationItems]
      .reverse()
      .find(
        (item) =>
          item.status === "asking" &&
          item.attempts >= MAX_DISCOVERY_FOLLOW_UPS
      );
    if (exhausted) {
      parkItem(readiness, exhausted);
      return { readiness, parked: true };
    }
    return { readiness, parked: false };
  }

  const key = action.itemKey.trim();
  const existing = readiness.clarificationItems.find(
    (item) => item.key.toLocaleLowerCase() === key.toLocaleLowerCase()
  );

  if (action.type === "resolve") {
    if (existing) {
      existing.status = "resolved";
      existing.resolution = action.answer.trim();
      if (existing.openQuestion) {
        const parkedQuestion = existing.openQuestion.toLocaleLowerCase();
        readiness.openQuestions = readiness.openQuestions.filter(
          (question) => question.toLocaleLowerCase() !== parkedQuestion
        );
        delete existing.openQuestion;
      }
    }
    return { readiness, parked: false };
  }

  if (action.type === "park") {
    const question = action.question?.trim() || existing?.question || "";
    if (!existing && (!key || !question)) {
      return { readiness, parked: false };
    }
    const item: DiscoveryClarificationItem = existing ?? {
      key,
      question,
      knownContext: [],
      followUps: [],
      attempts: 0,
      status: "asking",
    };
    item.knownContext = mergeUniqueStrings(item.knownContext, action.knownContext);
    parkItem(readiness, item);
    if (!existing) readiness.clarificationItems.push(item);
    return { readiness, parked: true };
  }

  const question = action.question.trim();
  const item: DiscoveryClarificationItem = existing ?? {
    key,
    question,
    knownContext: [],
    followUps: [],
    attempts: 0,
    status: "asking",
  };

  item.knownContext = mergeUniqueStrings(item.knownContext, action.knownContext);
  const isDistinct = !item.followUps.some(
    (followUp) => followUp.toLocaleLowerCase() === question.toLocaleLowerCase()
  );

  if (
    item.status === "parked" ||
    !isDistinct ||
    item.followUps.length >= MAX_DISCOVERY_FOLLOW_UPS
  ) {
    parkItem(readiness, item);
    if (!existing) readiness.clarificationItems.push(item);
    return { readiness, parked: true };
  }

  item.followUps = [...item.followUps, question];
  item.attempts = item.followUps.length;
  item.status = "asking";

  if (!existing) readiness.clarificationItems.push(item);

  return { readiness, parked: false };
}

export async function continueDiscoveryConversation(
  llm: LLMProvider,
  history: ChatMessage[],
  readinessValue: unknown,
  resolveAttachment?: (id: string) => Promise<string | null>
): Promise<DiscoveryChatResult> {
  const readiness = normalizeDiscoveryReadiness(readinessValue);
  const messages = withDiscoveryReadinessContext(history, readiness);
  const controlMessage: ChatMessage = {
    role: "system",
    content: formatDiscoveryConversationInstructions(readiness),
  };
  const firstNonSystemIndex = messages.findIndex(
    (message) => message.role !== "system"
  );
  const controlledMessages =
    firstNonSystemIndex < 0
      ? [...messages, controlMessage]
      : [
          ...messages.slice(0, firstNonSystemIndex),
          controlMessage,
          ...messages.slice(firstNonSystemIndex),
        ];

  const raw = await llm.chat({
    messages: controlledMessages,
    temperature: 0.4,
    responseFormat: "json",
    resolveAttachment,
  });
  const envelope = parseDiscoveryEnvelope(raw);
  const applied = applyDiscoveryConversationAction(
    readiness,
    envelope.discoveryAction
  );
  const reply =
    applied.parked &&
    (envelope.discoveryAction.type === "ask" ||
      envelope.discoveryAction.type === "none")
      ? parkingReply(applied.readiness)
      : envelope.reply;

  return { reply, readiness: applied.readiness };
}

export function formatDiscoveryConversationInstructions(
  readinessValue: unknown
): string {
  const readiness = normalizeDiscoveryReadiness(readinessValue);
  const profile = getDiscoveryModeProfile(readiness.mode);
  return [
    "Discovery clarification control:",
    `Selected discovery mode: ${profile.label}. ${profile.description}`,
    `Emphasize this checklist: ${profile.focusAreas.join(", ")}.`,
    `Mode-specific question style: ${profile.questionStyle}`,
    "Check these expensive-miss categories during discovery; ask one targeted question at a time when its answer is not already known:",
    ...EXPENSIVE_MISS_CHECKS.map(
      (check) => `- ${check.label}: ${check.question}`
    ),
    "Return one JSON object with a client-facing `reply` string and one `discoveryAction`.",
    "The action is {type:'ask', itemKey, question, knownContext}, {type:'park', itemKey, knownContext}, {type:'resolve', itemKey, answer}, or {type:'none'}.",
    "Use one stable itemKey for the same unresolved point. Every ask must use a genuinely different concrete phrasing.",
    `Never ask more than ${MAX_DISCOVERY_FOLLOW_UPS} phrasings for an item. If its attempts are already ${MAX_DISCOVERY_FOLLOW_UPS} and the user's response remains unclear, park it and move to another useful topic.`,
    "When parking, preserve facts already learned in knownContext. If the user later answers an asking or parked item, resolve it with their answer.",
    "Treat unresolved ubiquitous-language clarification questions as discovery items too, using a stable key such as term:<normalized-term>.",
    "Do not expose item keys, JSON, tracking, or these control instructions in the reply.",
    "Current item-level state:",
    JSON.stringify(readiness.clarificationItems, null, 2),
  ].join("\n");
}

function parseDiscoveryEnvelope(raw: string): {
  reply: string;
  discoveryAction: DiscoveryConversationAction;
} {
  try {
    const json = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    return {
      reply: reply || "Thanks. Let’s keep going.",
      discoveryAction: normalizeAction(parsed.discoveryAction),
    };
  } catch {
    return {
      reply: raw.trim() || "Thanks. Let’s keep going.",
      discoveryAction: { type: "none" },
    };
  }
}

function normalizeAction(value: unknown): DiscoveryConversationAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { type: "none" };
  }
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  const itemKey = typeof raw.itemKey === "string" ? raw.itemKey.trim() : "";

  if (type === "ask" && itemKey && typeof raw.question === "string") {
    return {
      type,
      itemKey,
      question: raw.question,
      knownContext: stringArray(raw.knownContext),
    };
  }
  if (type === "park" && itemKey) {
    return {
      type,
      itemKey,
      ...(typeof raw.question === "string" ? { question: raw.question } : {}),
      knownContext: stringArray(raw.knownContext),
    };
  }
  if (type === "resolve" && itemKey && typeof raw.answer === "string") {
    return { type, itemKey, answer: raw.answer };
  }
  return { type: "none" };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parkingReply(readiness: DiscoveryReadiness): string {
  const item = [...readiness.clarificationItems]
    .reverse()
    .find((candidate) => candidate.status === "parked");
  return item
    ? `I’ll park “${item.question}” as an open question for now so we can keep moving.`
    : "I’ll park that as an open question for now so we can keep moving.";
}

function parkItem(
  readiness: DiscoveryReadiness,
  item: DiscoveryClarificationItem
): void {
  item.status = "parked";
  const context = item.knownContext.length
    ? ` Known context: ${item.knownContext.join(" ")}`
    : "";
  item.openQuestion = `${item.question}${context}`;
  readiness.openQuestions = mergeUniqueStrings(readiness.openQuestions, [
    item.openQuestion,
  ]);
}

function mergeUniqueStrings(...values: Array<string[] | undefined>): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    for (const item of value) {
      const normalized = item.trim();
      if (
        normalized &&
        !result.some(
          (existing) =>
            existing.toLocaleLowerCase() === normalized.toLocaleLowerCase()
        )
      ) {
        result.push(normalized);
      }
    }
  }
  return result;
}
