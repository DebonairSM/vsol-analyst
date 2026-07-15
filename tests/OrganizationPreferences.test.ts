import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOrganizationContextDecisions,
  createPendingOrganizationContext,
  normalizeOrganizationPreferences,
  organizationPreferenceAssumption,
  removeOrganizationPreference,
  upsertOrganizationPreference,
} from "../src/analyst/OrganizationPreferences";
import {
  createEmptyDiscoveryReadiness,
  formatDiscoveryReadinessContext,
} from "../src/analyst/DiscoveryReadiness";

const now = "2026-07-15T12:00:00.000Z";

test("organization preferences can be added, edited, and removed", () => {
  const created = upsertOrganizationPreference(
    null,
    "report-1",
    {
      category: "preferred_report",
      label: "Board report",
      value: "Monthly PDF by program",
    },
    now
  );
  const edited = upsertOrganizationPreference(
    created,
    "report-1",
    {
      category: "preferred_report",
      label: "Board report",
      value: "Monthly PDF by program and region",
      notes: "Send on the first business day",
    },
    "2026-07-16T12:00:00.000Z"
  );

  assert.equal(edited.items.length, 1);
  assert.equal(edited.items[0].createdAt, now);
  assert.equal(edited.items[0].value, "Monthly PDF by program and region");
  assert.equal(removeOrganizationPreference(edited, "report-1").items.length, 0);
});

test("saved preferences enter a new project as pending confirmation", () => {
  const preferences = upsertOrganizationPreference(
    null,
    "integration-1",
    {
      category: "recurring_integration",
      label: "Accounting system",
      value: "QuickBooks Online",
    },
    now
  );
  const context = createPendingOrganizationContext(preferences);

  assert.equal(context.length, 1);
  assert.equal(context[0].status, "pending_confirmation");
});

test("only explicit acceptance adds remembered context as an assumption", () => {
  let preferences = upsertOrganizationPreference(
    null,
    "role-1",
    {
      category: "standard_role",
      label: "Final approver",
      value: "Operations Director",
    },
    now
  );
  preferences = upsertOrganizationPreference(
    preferences,
    "term-1",
    {
      category: "key_term",
      label: "Preferred term",
      value: "Referral",
    },
    now
  );
  const context = createPendingOrganizationContext(preferences);
  const result = applyOrganizationContextDecisions(
    context,
    ["The project has a mobile deadline"],
    [
      { id: "role-1", action: "accept" },
      { id: "term-1", action: "dismiss" },
    ]
  );

  assert.equal(result.organizationContext[0].status, "accepted_as_assumption");
  assert.equal(result.organizationContext[1].status, "dismissed");
  assert.ok(result.assumptions.includes("The project has a mobile deadline"));
  assert.ok(
    result.assumptions.includes(
      organizationPreferenceAssumption(result.organizationContext[0])
    )
  );
  assert.ok(!result.assumptions.some((item) => item.includes("Referral")));
});

test("discovery prompt never treats pending memory as a project fact", () => {
  const readiness = createEmptyDiscoveryReadiness();
  readiness.organizationContext = createPendingOrganizationContext({
    version: 1,
    items: [
      {
        id: "delivery-1",
        category: "delivery_preference",
        label: "Review cadence",
        value: "Weekly demos",
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  const context = formatDiscoveryReadinessContext(readiness);

  assert.match(context, /pending_confirmation/);
  assert.match(context, /Never treat pending remembered context as a project fact/);
  assert.match(context, /Accepted items remain project assumptions/);
});

test("malformed saved preferences normalize to a safe empty model", () => {
  assert.deepEqual(normalizeOrganizationPreferences({ items: [{ id: "bad" }] }), {
    version: 1,
    items: [],
  });
});
