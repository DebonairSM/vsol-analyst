import type {
  BusinessTerm,
  BusinessTermStatus,
  RequirementsSummary,
} from "./RequirementsTypes";

type RequirementsWithTerminology = RequirementsSummary & {
  ubiquitousLanguage: BusinessTerm[];
  openQuestions: string[];
};

/**
 * Normalize model-produced terminology without inventing business meaning.
 * This also makes legacy RequirementsSummary JSON safe to render.
 */
export function normalizeBusinessTerms(value: unknown): BusinessTerm[] {
  if (!Array.isArray(value)) return [];

  const terms = new Map<string, BusinessTerm>();

  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;

    const raw = candidate as Record<string, unknown>;
    const preferredTerm = normalizeString(raw.preferredTerm);
    if (!preferredTerm) continue;

    const key = preferredTerm.toLocaleLowerCase();
    if (terms.has(key)) continue;

    const status = normalizeStatus(raw.status);
    const clarificationQuestion = normalizeString(raw.clarificationQuestion);

    terms.set(key, {
      preferredTerm,
      definition: normalizeString(raw.definition),
      aliases: normalizeStringArray(raw.aliases).filter(
        (alias) => alias.toLocaleLowerCase() !== key
      ),
      status,
      sources: normalizeStringArray(raw.sources),
      ...(clarificationQuestion ? { clarificationQuestion } : {}),
    });
  }

  return [...terms.values()];
}

/**
 * Keep unresolved terminology explicit. A model cannot quietly treat an
 * ambiguous word as confirmed by omitting its clarification question.
 */
export function includeUbiquitousLanguageContext(
  requirements: RequirementsSummary
): RequirementsWithTerminology {
  const ubiquitousLanguage = normalizeBusinessTerms(
    requirements.ubiquitousLanguage
  );
  const openQuestions = mergeUniqueStrings(requirements.openQuestions);

  for (const term of ubiquitousLanguage) {
    if (term.status !== "needs-clarification") continue;

    const question =
      term.clarificationQuestion ||
      `What does "${term.preferredTerm}" mean in your business?`;

    term.clarificationQuestion = question;
    addUniqueString(openQuestions, question);
  }

  return {
    ...requirements,
    ubiquitousLanguage,
    openQuestions,
  };
}

function normalizeStatus(value: unknown): BusinessTermStatus {
  return value === "confirmed" ? "confirmed" : "needs-clarification";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) addUniqueString(result, normalizeString(item));
  return result;
}

function mergeUniqueStrings(value: unknown): string[] {
  return normalizeStringArray(value);
}

function addUniqueString(target: string[], value: string): void {
  if (!value) return;
  const normalized = value.toLocaleLowerCase();
  if (!target.some((item) => item.toLocaleLowerCase() === normalized)) {
    target.push(value);
  }
}
