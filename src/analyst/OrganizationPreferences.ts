export const ORGANIZATION_PREFERENCES_VERSION = 1 as const;

export const ORGANIZATION_PREFERENCE_CATEGORIES = [
  "key_term",
  "standard_role",
  "preferred_report",
  "recurring_integration",
  "delivery_preference",
] as const;

export type OrganizationPreferenceCategory =
  (typeof ORGANIZATION_PREFERENCE_CATEGORIES)[number];

export interface OrganizationPreferenceItem {
  id: string;
  category: OrganizationPreferenceCategory;
  label: string;
  value: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationPreferences {
  version: typeof ORGANIZATION_PREFERENCES_VERSION;
  items: OrganizationPreferenceItem[];
}

export type OrganizationContextStatus =
  | "pending_confirmation"
  | "accepted_as_assumption"
  | "dismissed";

export interface OrganizationContextItem extends OrganizationPreferenceItem {
  status: OrganizationContextStatus;
}

export interface OrganizationPreferenceInput {
  category: OrganizationPreferenceCategory;
  label: string;
  value: string;
  notes?: string;
}

export interface OrganizationContextDecision {
  id: string;
  action: "accept" | "dismiss";
}

export function createEmptyOrganizationPreferences(): OrganizationPreferences {
  return { version: ORGANIZATION_PREFERENCES_VERSION, items: [] };
}

export function normalizeOrganizationPreferences(
  value: unknown
): OrganizationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyOrganizationPreferences();
  }
  const raw = value as { items?: unknown };
  return {
    version: ORGANIZATION_PREFERENCES_VERSION,
    items: normalizePreferenceItems(raw.items),
  };
}

export function normalizeOrganizationContext(
  value: unknown
): OrganizationContextItem[] {
  if (!Array.isArray(value)) return [];
  return normalizePreferenceItems(value).map((item) => {
    const raw = value.find(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        (candidate as { id?: unknown }).id === item.id
    ) as { status?: unknown } | undefined;
    const status: OrganizationContextStatus =
      raw?.status === "accepted_as_assumption" || raw?.status === "dismissed"
        ? raw.status
        : "pending_confirmation";
    return { ...item, status };
  });
}

export function createPendingOrganizationContext(
  preferencesValue: unknown
): OrganizationContextItem[] {
  return normalizeOrganizationPreferences(preferencesValue).items.map((item) => ({
    ...item,
    status: "pending_confirmation",
  }));
}

export function upsertOrganizationPreference(
  currentValue: unknown,
  id: string,
  input: OrganizationPreferenceInput,
  now = new Date().toISOString()
): OrganizationPreferences {
  const current = normalizeOrganizationPreferences(currentValue);
  const normalizedInput = normalizePreferenceInput(input);
  const index = current.items.findIndex((item) => item.id === id);
  const existing = index >= 0 ? current.items[index] : undefined;
  const item: OrganizationPreferenceItem = {
    id,
    ...normalizedInput,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const items = [...current.items];
  if (index >= 0) items[index] = item;
  else items.push(item);
  return { version: ORGANIZATION_PREFERENCES_VERSION, items };
}

export function removeOrganizationPreference(
  currentValue: unknown,
  id: string
): OrganizationPreferences {
  const current = normalizeOrganizationPreferences(currentValue);
  return {
    version: ORGANIZATION_PREFERENCES_VERSION,
    items: current.items.filter((item) => item.id !== id),
  };
}

export function applyOrganizationContextDecisions(
  contextValue: unknown,
  assumptionsValue: unknown,
  decisions: OrganizationContextDecision[]
): { organizationContext: OrganizationContextItem[]; assumptions: string[] } {
  const decisionsById = new Map(decisions.map((decision) => [decision.id, decision.action]));
  const context = normalizeOrganizationContext(contextValue).map((item) => {
    const action = decisionsById.get(item.id);
    return action
      ? {
          ...item,
          status:
            action === "accept"
              ? ("accepted_as_assumption" as const)
              : ("dismissed" as const),
        }
      : item;
  });

  const managedAssumptions = new Set(
    context.map(organizationPreferenceAssumption).map((item) => item.toLocaleLowerCase())
  );
  const assumptions = stringArray(assumptionsValue).filter(
    (item) => !managedAssumptions.has(item.toLocaleLowerCase())
  );
  for (const item of context) {
    if (item.status === "accepted_as_assumption") {
      assumptions.push(organizationPreferenceAssumption(item));
    }
  }

  return { organizationContext: context, assumptions: uniqueStrings(assumptions) };
}

export function organizationPreferenceAssumption(
  item: Pick<OrganizationPreferenceItem, "label" | "value">
): string {
  return `Organization preference accepted for this project — ${item.label}: ${item.value}`;
}

export function isOrganizationPreferenceCategory(
  value: unknown
): value is OrganizationPreferenceCategory {
  return (
    typeof value === "string" &&
    (ORGANIZATION_PREFERENCE_CATEGORIES as readonly string[]).includes(value)
  );
}

export function normalizePreferenceInput(
  value: unknown
): OrganizationPreferenceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Preference input must be an object.");
  }
  const raw = value as Record<string, unknown>;
  if (!isOrganizationPreferenceCategory(raw.category)) {
    throw new Error("A valid preference category is required.");
  }
  const label = requiredText(raw.label, "label");
  const preferenceValue = requiredText(raw.value, "value");
  const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
  return {
    category: raw.category,
    label,
    value: preferenceValue,
    ...(notes ? { notes } : {}),
  };
}

function normalizePreferenceItems(value: unknown): OrganizationPreferenceItem[] {
  if (!Array.isArray(value)) return [];
  const items = new Map<string, OrganizationPreferenceItem>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue;
    }
    const raw = candidate as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id || items.has(id)) continue;
    try {
      const input = normalizePreferenceInput(raw);
      const createdAt = validDateText(raw.createdAt) ?? new Date(0).toISOString();
      const updatedAt = validDateText(raw.updatedAt) ?? createdAt;
      items.set(id, { id, ...input, createdAt, updatedAt });
    } catch {
      continue;
    }
  }
  return [...items.values()];
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function validDateText(value: unknown): string | undefined {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function uniqueStrings(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const item of values) {
    const normalized = item.trim();
    if (normalized && !unique.has(normalized.toLocaleLowerCase())) {
      unique.set(normalized.toLocaleLowerCase(), normalized);
    }
  }
  return [...unique.values()];
}
