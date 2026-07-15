export const DISCOVERY_READINESS_VERSION = 1 as const;

export type DiscoveryReadinessStatus =
  | "not_started"
  | "in_progress"
  | "ready"
  | "blocked";

export interface DiscoveryReadinessSection {
  key: string;
  status: DiscoveryReadinessStatus;
  confidence: number;
  attempts: number;
  assumptions: string[];
  openQuestions: string[];
}

export interface DiscoveryReadiness {
  version: typeof DISCOVERY_READINESS_VERSION;
  status: DiscoveryReadinessStatus;
  confidence: number;
  attempts: number;
  sections: DiscoveryReadinessSection[];
  assumptions: string[];
  openQuestions: string[];
}

export interface DiscoveryReadinessSectionPatch {
  key: string;
  status?: DiscoveryReadinessStatus;
  confidence?: number;
  attempts?: number;
  assumptions?: string[];
  openQuestions?: string[];
}

export interface DiscoveryReadinessPatch {
  status?: DiscoveryReadinessStatus;
  confidence?: number;
  attempts?: number;
  sections?: DiscoveryReadinessSectionPatch[];
  assumptions?: string[];
  openQuestions?: string[];
}

export function createEmptyDiscoveryReadiness(): DiscoveryReadiness {
  return {
    version: DISCOVERY_READINESS_VERSION,
    status: "not_started",
    confidence: 0,
    attempts: 0,
    sections: [],
    assumptions: [],
    openQuestions: [],
  };
}

export function normalizeDiscoveryReadiness(
  value: unknown
): DiscoveryReadiness {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyDiscoveryReadiness();
  }

  const candidate = value as Partial<DiscoveryReadiness>;
  const empty = createEmptyDiscoveryReadiness();

  return {
    version: DISCOVERY_READINESS_VERSION,
    status: normalizeStatus(candidate.status, empty.status),
    confidence: normalizeConfidence(candidate.confidence, empty.confidence),
    attempts: normalizeAttempts(candidate.attempts, empty.attempts),
    sections: Array.isArray(candidate.sections)
      ? candidate.sections
          .filter(isRecordWithKey)
          .map((section) => normalizeSection(section))
      : [],
    assumptions: normalizeStringArray(candidate.assumptions),
    openQuestions: normalizeStringArray(candidate.openQuestions),
  };
}

export function mergeDiscoveryReadiness(
  currentValue: unknown,
  patch: DiscoveryReadinessPatch
): DiscoveryReadiness {
  const current = normalizeDiscoveryReadiness(currentValue);
  const sections = [...current.sections];

  const sectionPatches = Array.isArray(patch.sections)
    ? patch.sections.filter(isRecordWithKey)
    : [];

  for (const sectionPatch of sectionPatches) {
    const key = sectionPatch.key.trim();
    const index = sections.findIndex((section) => section.key === key);
    const existing = index >= 0 ? sections[index] : undefined;
    const merged = normalizeSection({ ...existing, ...sectionPatch, key });

    if (index >= 0) {
      sections[index] = merged;
    } else {
      sections.push(merged);
    }
  }

  return {
    version: DISCOVERY_READINESS_VERSION,
    status: normalizeStatus(patch.status, current.status),
    confidence: normalizeConfidence(patch.confidence, current.confidence),
    attempts: normalizeAttempts(patch.attempts, current.attempts),
    sections,
    assumptions:
      patch.assumptions === undefined
        ? current.assumptions
        : normalizeStringArray(patch.assumptions),
    openQuestions:
      patch.openQuestions === undefined
        ? current.openQuestions
        : normalizeStringArray(patch.openQuestions),
  };
}

export function buildDiscoveryReadinessPersistenceData(
  currentValue: unknown,
  patch: DiscoveryReadinessPatch
): { discoveryReadiness: DiscoveryReadiness } {
  return {
    discoveryReadiness: mergeDiscoveryReadiness(currentValue, patch),
  };
}

export function formatDiscoveryReadinessContext(value: unknown): string {
  const readiness = normalizeDiscoveryReadiness(value);

  return [
    "Discovery readiness context (persisted project coverage and gaps):",
    JSON.stringify(readiness, null, 2),
    "Use this as supporting context. Explicit user statements and user-corrected requirements are authoritative; do not replace them with readiness assumptions. Keep unresolved readiness questions visible in the extracted requirements where relevant.",
  ].join("\n");
}

export function withDiscoveryReadinessContext<T extends { role: string; content: unknown }>(
  messages: T[],
  value: unknown
): T[] {
  const contextMessage = {
    role: "system",
    content: formatDiscoveryReadinessContext(value),
  } as T;
  const firstNonSystemIndex = messages.findIndex(
    (message) => message.role !== "system"
  );

  if (firstNonSystemIndex < 0) {
    return [...messages, contextMessage];
  }

  return [
    ...messages.slice(0, firstNonSystemIndex),
    contextMessage,
    ...messages.slice(firstNonSystemIndex),
  ];
}

function isRecordWithKey(value: unknown): value is Record<string, unknown> & { key: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as { key?: unknown }).key === "string" &&
      (value as { key: string }).key.trim()
  );
}

function normalizeSection(
  value: Partial<DiscoveryReadinessSection> & { key: string }
): DiscoveryReadinessSection {
  return {
    key: value.key.trim(),
    status: normalizeStatus(value.status, "not_started"),
    confidence: normalizeConfidence(value.confidence, 0),
    attempts: normalizeAttempts(value.attempts, 0),
    assumptions: normalizeStringArray(value.assumptions),
    openQuestions: normalizeStringArray(value.openQuestions),
  };
}

function normalizeStatus(
  value: unknown,
  fallback: DiscoveryReadinessStatus
): DiscoveryReadinessStatus {
  return value === "not_started" ||
    value === "in_progress" ||
    value === "ready" ||
    value === "blocked"
    ? value
    : fallback;
}

function normalizeConfidence(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function normalizeAttempts(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
