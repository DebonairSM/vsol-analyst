import assert from "node:assert/strict";
import test from "node:test";
import { RequirementsExtractor } from "../src/analyst/RequirementsExtractor";
import { DocumentGenerator } from "../src/analyst/DocumentGenerator";
import { ChatMessage, LLMProvider } from "../src/llm/LLMProvider";
import {
  assessDiscoveryReadiness,
  buildDiscoveryReadinessPersistenceData,
  getDiscoveryModeProfile,
  getDiscoveryReadinessThreshold,
  includeIncompleteDiscoveryContext,
  mergeDiscoveryReadiness,
  normalizeDiscoveryReadiness,
  setDiscoveryMode,
  withDiscoveryReadinessContext,
} from "../src/analyst/DiscoveryReadiness";

test("readiness threshold is configurable with a safe default", () => {
  assert.equal(getDiscoveryReadinessThreshold(""), 0.7);
  assert.equal(getDiscoveryReadinessThreshold("0.85"), 0.85);
  assert.equal(getDiscoveryReadinessThreshold("85"), 0.7);
  assert.equal(getDiscoveryReadinessThreshold("not-a-number"), 0.7);
});

test("thin discovery warning identifies missing and low-confidence areas", () => {
  const warning = assessDiscoveryReadiness(
    {
      status: "in_progress",
      confidence: 0.45,
      assumptions: ["Managers approve exceptions"],
      openQuestions: ["Who owns the final approval?"],
      sections: [
        {
          key: "business_context",
          status: "not_started",
          confidence: 0,
        },
        {
          key: "approval_workflow",
          status: "in_progress",
          confidence: 0.5,
          openQuestions: ["Is a second approval required?"],
        },
      ],
    },
    0.7
  );

  assert.equal(warning.shouldWarn, true);
  assert.equal(warning.isBelowThreshold, true);
  assert.deepEqual(
    warning.missingAreas.map((area) => area.key),
    ["business_context"]
  );
  assert.deepEqual(
    warning.lowConfidenceAreas.map((area) => area.key),
    ["approval_workflow"]
  );
  assert.deepEqual(warning.openQuestions, [
    "Who owns the final approval?",
    "Is a second approval required?",
  ]);
});

test("completed discovery does not show a warning", () => {
  const warning = assessDiscoveryReadiness(
    {
      status: "ready",
      confidence: 0.9,
      sections: [
        {
          key: "business_context",
          status: "ready",
          confidence: 0.9,
        },
      ],
    },
    0.7
  );

  assert.equal(warning.shouldWarn, false);
  assert.deepEqual(warning.missingAreas, []);
  assert.deepEqual(warning.lowConfidenceAreas, []);
});

test("configured threshold controls whether the warning is shown", () => {
  const readiness = {
    status: "in_progress",
    confidence: 0.8,
    sections: [],
  };

  assert.equal(assessDiscoveryReadiness(readiness, 0.7).shouldWarn, false);
  assert.equal(assessDiscoveryReadiness(readiness, 0.85).shouldWarn, true);
});

test("incomplete discovery assumptions and questions are visible in requirements", () => {
  const requirements = includeIncompleteDiscoveryContext(
    {
      businessContext: {},
      primaryGoal: "Reduce approval delays",
      secondaryGoals: [],
      currentTools: [],
      mainActors: [],
      painPoints: [],
      dataEntities: [],
      candidateModules: [],
      nonFunctionalNeeds: [],
      risksAndConstraints: [],
      assumptions: ["Requests arrive by email"],
      openQuestions: ["What is the target turnaround time?"],
      uploadedDocuments: [],
      workflowDiagram: "flowchart TD",
    },
    {
      status: "in_progress",
      confidence: 0.4,
      assumptions: ["Managers approve exceptions"],
      openQuestions: ["Who owns the final approval?"],
    },
    0.7
  );
  const markdown = new DocumentGenerator().generateRequirementsMarkdown(
    requirements
  );

  assert.deepEqual(requirements.assumptions, [
    "Requests arrive by email",
    "Managers approve exceptions",
  ]);
  assert.deepEqual(requirements.openQuestions, [
    "What is the target turnaround time?",
    "Who owns the final approval?",
  ]);
  assert.match(markdown, /## Assumptions/);
  assert.match(markdown, /Managers approve exceptions/);
  assert.match(markdown, /## Open Questions/);
  assert.match(markdown, /Who owns the final approval\?/);
});

test("requirements keep assumption and question review sections visible when empty", () => {
  const requirements = includeIncompleteDiscoveryContext(
    {
      businessContext: {},
      primaryGoal: "Clarify the requested system",
      secondaryGoals: [],
      currentTools: [],
      mainActors: [],
      painPoints: [],
      dataEntities: [],
      candidateModules: [],
      nonFunctionalNeeds: [],
      risksAndConstraints: [],
      openQuestions: [],
      uploadedDocuments: [],
      workflowDiagram: "flowchart TD",
    },
    { status: "not_started", confidence: 0 },
    0.7
  );
  const markdown = new DocumentGenerator().generateRequirementsMarkdown(
    requirements
  );

  assert.match(markdown, /## Assumptions\nNo assumptions have been recorded\./);
  assert.match(markdown, /## Open Questions\nNo open questions have been recorded\./);
});

test("projects without discovery readiness load with a safe default", () => {
  assert.deepEqual(normalizeDiscoveryReadiness(null), {
    version: 1,
    mode: "quick_scope",
    status: "not_started",
    confidence: 0,
    attempts: 0,
    sections: [],
    assumptions: [],
    openQuestions: [],
    clarificationItems: [],
  });
});

test("discovery modes expose distinct checklist and question guidance", () => {
  const quick = getDiscoveryModeProfile("quick_scope");
  const migration = getDiscoveryModeProfile("data_migration");

  assert.equal(quick.label, "Quick Scope");
  assert.deepEqual(quick.focusAreas, ["business_context"]);
  assert.match(migration.questionStyle, /source data/i);
  assert.ok(migration.focusAreas.includes("cutover_and_rollback"));
});

test("changing discovery mode preserves accumulated readiness state", () => {
  const current = normalizeDiscoveryReadiness({
    mode: "quick_scope",
    status: "in_progress",
    confidence: 0.65,
    assumptions: ["Operators own exceptions"],
    openQuestions: ["What is the cutover window?"],
    sections: [{ key: "business_context", status: "ready", confidence: 0.9 }],
  });

  const updated = setDiscoveryMode(current, "data_migration");

  assert.equal(updated.mode, "data_migration");
  assert.equal(updated.confidence, 0.65);
  assert.deepEqual(updated.assumptions, current.assumptions);
  assert.deepEqual(updated.openQuestions, current.openQuestions);
  assert.deepEqual(updated.sections, current.sections);
});

test("selected mode changes readiness emphasis and scoring", () => {
  const base = {
    status: "ready",
    confidence: 0.9,
    sections: [{ key: "business_context", status: "ready", confidence: 0.9 }],
  };
  const quick = assessDiscoveryReadiness({ ...base, mode: "quick_scope" }, 0.7);
  const integration = assessDiscoveryReadiness(
    { ...base, mode: "integration_heavy" },
    0.7
  );

  assert.equal(quick.shouldWarn, false);
  assert.equal(integration.shouldWarn, true);
  assert.ok(integration.missingAreas.some((area) => area.key === "data_contracts"));
});

test("readiness patches preserve readiness fields that are not updated", () => {
  const current = normalizeDiscoveryReadiness({
    version: 1,
    status: "in_progress",
    confidence: 0.4,
    attempts: 2,
    sections: [
      {
        key: "business_context",
        status: "in_progress",
        confidence: 0.5,
        attempts: 1,
        assumptions: ["Seasonal demand is material"],
        openQuestions: ["Which months are busiest?"],
      },
    ],
    assumptions: ["The current process is manual"],
    openQuestions: ["Who approves exceptions?"],
  });

  const updated = mergeDiscoveryReadiness(current, {
    confidence: 0.8,
    sections: [
      {
        key: "business_context",
        status: "ready",
        confidence: 0.9,
      },
    ],
  });

  assert.equal(updated.confidence, 0.8);
  assert.deepEqual(updated.assumptions, ["The current process is manual"]);
  assert.deepEqual(updated.openQuestions, ["Who approves exceptions?"]);
  assert.deepEqual(updated.sections[0], {
    key: "business_context",
    status: "ready",
    confidence: 0.9,
    attempts: 1,
    assumptions: ["Seasonal demand is material"],
    openQuestions: ["Which months are busiest?"],
  });
});

test("readiness persistence never writes user-corrected requirements", () => {
  const data = buildDiscoveryReadinessPersistenceData(null, {
    status: "in_progress",
    attempts: 1,
  });

  assert.deepEqual(Object.keys(data), ["discoveryReadiness"]);
  assert.equal("generatedRequirements" in data, false);
});

test("section patches normalize keys before merging", () => {
  const updated = mergeDiscoveryReadiness(
    {
      sections: [
        {
          key: "business_context",
          status: "in_progress",
          attempts: 1,
        },
      ],
    },
    {
      sections: [
        {
          key: " business_context ",
          status: "ready",
        },
      ],
    }
  );

  assert.equal(updated.sections.length, 1);
  assert.equal(updated.sections[0].key, "business_context");
  assert.equal(updated.sections[0].status, "ready");
  assert.equal(updated.sections[0].attempts, 1);
});

test("chat readiness context is ephemeral and follows the identity prompt", () => {
  const history: ChatMessage[] = [
    { role: "system", content: "You are Sunny." },
    { role: "user", content: "Help me define the workflow." },
  ];

  const messages = withDiscoveryReadinessContext(history, {
    status: "in_progress",
    openQuestions: ["Who handles exceptions?"],
  });

  assert.equal(history.length, 2);
  assert.equal(messages.length, 3);
  assert.equal(messages[0].content, "You are Sunny.");
  assert.equal(messages[1].role, "system");
  assert.match(messages[1].content as string, /Who handles exceptions\?/);
  assert.equal(messages[2].content, "Help me define the workflow.");
});

test("requirements extraction includes persisted readiness context", async () => {
  let sentMessages: ChatMessage[] = [];
  const llm: LLMProvider = {
    async chat(options) {
      sentMessages = options.messages;
      return JSON.stringify({ uploadedDocuments: [] });
    },
  };
  const extractor = new RequirementsExtractor(llm);

  await extractor.extractFromTranscript(
    [{ role: "user", content: "We need an approval workflow." }],
    undefined,
    {
      version: 1,
      status: "in_progress",
      confidence: 0.6,
      attempts: 2,
      sections: [],
      assumptions: ["Managers approve exceptions"],
      openQuestions: ["Is a second approval required?"],
    }
  );

  const prompt = sentMessages
    .map((message) =>
      typeof message.content === "string" ? message.content : ""
    )
    .join("\n");

  assert.match(prompt, /discovery readiness context/i);
  assert.match(prompt, /Managers approve exceptions/);
  assert.match(prompt, /Is a second approval required\?/);
});
