export const DISCOVERY_READINESS_VERSION = 1 as const;
export const DEFAULT_DISCOVERY_READINESS_THRESHOLD = 0.7;

export const DISCOVERY_MODES = [
  "quick_scope",
  "deep_workflow",
  "mvp_definition",
  "integration_heavy",
  "data_migration",
] as const;

export type DiscoveryMode = (typeof DISCOVERY_MODES)[number];

export interface DiscoveryModeProfile {
  id: DiscoveryMode;
  label: string;
  description: string;
  questionStyle: string;
  focusAreas: string[];
}

const DISCOVERY_MODE_PROFILES: Record<DiscoveryMode, DiscoveryModeProfile> = {
  quick_scope: {
    id: "quick_scope",
    label: "Quick Scope",
    description: "Clarify the outcome, boundaries, and main business context quickly.",
    questionStyle: "Ask concise, high-signal questions and prefer a usable scope over exhaustive detail.",
    focusAreas: ["business_context"],
  },
  deep_workflow: {
    id: "deep_workflow",
    label: "Deep Workflow",
    description: "Map the end-to-end workflow, roles, decisions, and exception paths.",
    questionStyle: "Walk through concrete scenarios step by step, including handoffs, decisions, and exceptions.",
    focusAreas: ["current_workflow", "roles_and_handoffs", "exceptions_and_approvals"],
  },
  mvp_definition: {
    id: "mvp_definition",
    label: "MVP Definition",
    description: "Separate the first releasable outcome from later enhancements.",
    questionStyle: "Use prioritization and trade-off questions that distinguish must-haves from later scope.",
    focusAreas: ["primary_outcome", "must_have_scope", "success_metrics"],
  },
  integration_heavy: {
    id: "integration_heavy",
    label: "Integration Heavy",
    description: "Define system boundaries, contracts, security, failure handling, and ownership.",
    questionStyle: "Ask precise interface questions about systems, data contracts, authentication, failures, and operators.",
    focusAreas: ["connected_systems", "data_contracts", "security_and_access", "failure_operations"],
  },
  data_migration: {
    id: "data_migration",
    label: "Data Migration",
    description: "Plan source-to-target mapping, data quality, cutover, validation, and rollback.",
    questionStyle: "Ask evidence-based questions about source data, mappings, quality rules, reconciliation, and cutover safety.",
    focusAreas: ["source_data", "target_mapping", "data_quality", "cutover_and_rollback"],
  },
};

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

export type DiscoveryClarificationStatus = "asking" | "parked" | "resolved";

export interface DiscoveryClarificationItem {
  key: string;
  question: string;
  knownContext: string[];
  followUps: string[];
  attempts: number;
  status: DiscoveryClarificationStatus;
  resolution?: string;
  openQuestion?: string;
}

export interface DiscoveryReadiness {
  version: typeof DISCOVERY_READINESS_VERSION;
  mode: DiscoveryMode;
  status: DiscoveryReadinessStatus;
  confidence: number;
  attempts: number;
  sections: DiscoveryReadinessSection[];
  assumptions: string[];
  openQuestions: string[];
  clarificationItems: DiscoveryClarificationItem[];
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
  mode?: DiscoveryMode;
  status?: DiscoveryReadinessStatus;
  confidence?: number;
  attempts?: number;
  sections?: DiscoveryReadinessSectionPatch[];
  assumptions?: string[];
  openQuestions?: string[];
  clarificationItems?: DiscoveryClarificationItem[];
}

export interface DiscoveryReadinessArea {
  key: string;
  status: DiscoveryReadinessStatus;
  confidence: number;
}

export interface DiscoveryReadinessAssessment {
  mode: DiscoveryMode;
  modeLabel: string;
  focusAreas: string[];
  shouldWarn: boolean;
  isBelowThreshold: boolean;
  threshold: number;
  confidence: number;
  status: DiscoveryReadinessStatus;
  missingAreas: DiscoveryReadinessArea[];
  lowConfidenceAreas: DiscoveryReadinessArea[];
  assumptions: string[];
  openQuestions: string[];
}

export function createEmptyDiscoveryReadiness(
  mode: DiscoveryMode = "quick_scope"
): DiscoveryReadiness {
  return {
    version: DISCOVERY_READINESS_VERSION,
    mode,
    status: "not_started",
    confidence: 0,
    attempts: 0,
    sections: [],
    assumptions: [],
    openQuestions: [],
    clarificationItems: [],
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
    mode: normalizeDiscoveryMode(candidate.mode),
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
    clarificationItems: normalizeClarificationItems(
      candidate.clarificationItems
    ),
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
    mode:
      patch.mode === undefined
        ? current.mode
        : normalizeDiscoveryMode(patch.mode, current.mode),
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
    clarificationItems:
      patch.clarificationItems === undefined
        ? current.clarificationItems
        : normalizeClarificationItems(patch.clarificationItems),
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
  const profile = getDiscoveryModeProfile(readiness.mode);

  return [
    "Discovery readiness context (persisted project coverage and gaps):",
    JSON.stringify(readiness, null, 2),
    `Selected discovery mode: ${profile.label}. ${profile.description}`,
    `Mode focus checklist: ${profile.focusAreas.join(", ")}.`,
    `Question style: ${profile.questionStyle}`,
    "Use this as supporting context. Explicit user statements and user-corrected requirements are authoritative; do not replace them with readiness assumptions. Keep unresolved readiness questions visible in the extracted requirements where relevant.",
  ].join("\n");
}

export function getDiscoveryReadinessThreshold(
  configuredValue = process.env.DISCOVERY_READINESS_THRESHOLD
): number {
  if (configuredValue === undefined || configuredValue.trim() === "") {
    return DEFAULT_DISCOVERY_READINESS_THRESHOLD;
  }

  const threshold = Number(configuredValue);
  return Number.isFinite(threshold) && threshold >= 0 && threshold <= 1
    ? threshold
    : DEFAULT_DISCOVERY_READINESS_THRESHOLD;
}

export function assessDiscoveryReadiness(
  value: unknown,
  threshold = getDiscoveryReadinessThreshold()
): DiscoveryReadinessAssessment {
  const readiness = normalizeDiscoveryReadiness(value);
  const profile = getDiscoveryModeProfile(readiness.mode);
  const safeThreshold =
    Number.isFinite(threshold) && threshold >= 0 && threshold <= 1
      ? threshold
      : DEFAULT_DISCOVERY_READINESS_THRESHOLD;

  const missingAreas = readiness.sections
    .filter((section) => section.status === "not_started")
    .map(toReadinessArea);
  const sectionsByKey = new Map(
    readiness.sections.map((section) => [section.key.toLocaleLowerCase(), section])
  );
  for (const focusArea of profile.focusAreas) {
    if (!sectionsByKey.has(focusArea.toLocaleLowerCase())) {
      missingAreas.push({ key: focusArea, status: "not_started", confidence: 0 });
    }
  }
  const lowConfidenceAreas = readiness.sections
    .filter(
      (section) =>
        section.status !== "not_started" &&
        (section.confidence < safeThreshold || section.status === "blocked")
    )
    .map(toReadinessArea);

  const coveredFocusAreas = profile.focusAreas
    .map((key) => sectionsByKey.get(key.toLocaleLowerCase()))
    .filter((section): section is DiscoveryReadinessSection => Boolean(section));
  const focusConfidence = coveredFocusAreas.length
    ? coveredFocusAreas.reduce((sum, section) => sum + section.confidence, 0) /
      coveredFocusAreas.length
    : readiness.confidence;
  const adjustedConfidence = coveredFocusAreas.length
    ? readiness.confidence * 0.4 + focusConfidence * 0.6
    : readiness.confidence;
  const isBelowThreshold = adjustedConfidence < safeThreshold;
  const hasMissingFocusAreas =
    (readiness.mode !== "quick_scope" || readiness.sections.length > 0) &&
    profile.focusAreas.some(
      (key) => !sectionsByKey.has(key.toLocaleLowerCase())
    );
  const shouldWarn = isBelowThreshold || hasMissingFocusAreas;

  // A newly created or sparsely populated readiness record has no named
  // sections. Keep the warning useful by exposing the overall discovery area.
  if (shouldWarn && missingAreas.length === 0 && lowConfidenceAreas.length === 0) {
    const overallArea: DiscoveryReadinessArea = {
      key: "overall_discovery",
      status: readiness.status,
      confidence: adjustedConfidence,
    };

    if (readiness.status === "not_started") {
      missingAreas.push(overallArea);
    } else {
      lowConfidenceAreas.push(overallArea);
    }
  }

  const incompleteSections = readiness.sections.filter(
    (section) =>
      section.status !== "ready" || section.confidence < safeThreshold
  );

  return {
    mode: readiness.mode,
    modeLabel: profile.label,
    focusAreas: [...profile.focusAreas],
    shouldWarn,
    isBelowThreshold,
    threshold: safeThreshold,
    confidence: adjustedConfidence,
    status: readiness.status,
    missingAreas,
    lowConfidenceAreas,
    assumptions: mergeUniqueStrings(
      readiness.assumptions,
      ...incompleteSections.map((section) => section.assumptions)
    ),
    openQuestions: mergeUniqueStrings(
      readiness.openQuestions,
      ...incompleteSections.map((section) => section.openQuestions)
    ),
  };
}

export function isDiscoveryMode(value: unknown): value is DiscoveryMode {
  return (
    typeof value === "string" &&
    (DISCOVERY_MODES as readonly string[]).includes(value)
  );
}

export function normalizeDiscoveryMode(
  value: unknown,
  fallback: DiscoveryMode = "quick_scope"
): DiscoveryMode {
  return isDiscoveryMode(value) ? value : fallback;
}

export function getDiscoveryModeProfile(value: unknown): DiscoveryModeProfile {
  const profile = DISCOVERY_MODE_PROFILES[normalizeDiscoveryMode(value)];
  return { ...profile, focusAreas: [...profile.focusAreas] };
}

export function setDiscoveryMode(
  currentValue: unknown,
  mode: DiscoveryMode
): DiscoveryReadiness {
  return mergeDiscoveryReadiness(currentValue, { mode });
}

export function includeIncompleteDiscoveryContext<
  T extends { assumptions?: string[]; openQuestions?: string[] }
>(
  requirements: T,
  readinessValue: unknown,
  threshold = getDiscoveryReadinessThreshold()
): T & { assumptions: string[]; openQuestions: string[] } {
  const assessment = assessDiscoveryReadiness(readinessValue, threshold);
  const assumptions = assessment.shouldWarn
    ? mergeUniqueStrings(requirements.assumptions, assessment.assumptions)
    : mergeUniqueStrings(requirements.assumptions);
  const openQuestions = assessment.shouldWarn
    ? mergeUniqueStrings(requirements.openQuestions, assessment.openQuestions)
    : mergeUniqueStrings(requirements.openQuestions);

  return {
    ...requirements,
    assumptions,
    openQuestions,
  };
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

function normalizeClarificationItems(
  value: unknown
): DiscoveryClarificationItem[] {
  if (!Array.isArray(value)) return [];

  const items = new Map<string, DiscoveryClarificationItem>();
  for (const candidate of value) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      continue;
    }

    const raw = candidate as Partial<DiscoveryClarificationItem>;
    const key = typeof raw.key === "string" ? raw.key.trim() : "";
    const question = typeof raw.question === "string" ? raw.question.trim() : "";
    if (!key || !question || items.has(key.toLocaleLowerCase())) continue;

    const status: DiscoveryClarificationStatus =
      raw.status === "parked" || raw.status === "resolved"
        ? raw.status
        : "asking";
    const resolution =
      typeof raw.resolution === "string" ? raw.resolution.trim() : "";
    const openQuestion =
      typeof raw.openQuestion === "string" ? raw.openQuestion.trim() : "";

    items.set(key.toLocaleLowerCase(), {
      key,
      question,
      knownContext: normalizeStringArray(raw.knownContext),
      followUps: normalizeStringArray(raw.followUps),
      attempts: normalizeAttempts(raw.attempts, 0),
      status,
      ...(resolution ? { resolution } : {}),
      ...(openQuestion ? { openQuestion } : {}),
    });
  }

  return [...items.values()];
}

function toReadinessArea(
  section: DiscoveryReadinessSection
): DiscoveryReadinessArea {
  return {
    key: section.key,
    status: section.status,
    confidence: section.confidence,
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

function mergeUniqueStrings(...values: Array<unknown>): string[] {
  const merged = new Map<string, string>();

  for (const value of values) {
    for (const item of normalizeStringArray(value)) {
      const normalized = item.trim();
      if (normalized && !merged.has(normalized.toLocaleLowerCase())) {
        merged.set(normalized.toLocaleLowerCase(), normalized);
      }
    }
  }

  return [...merged.values()];
}
