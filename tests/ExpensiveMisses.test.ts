import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPENSIVE_MISS_CHECKS,
  assessDiscoveryReadiness,
  createEmptyDiscoveryReadiness,
  includeExpensiveMissContext,
  mergeDiscoveryReadiness,
} from "../src/analyst/DiscoveryReadiness";
import { formatDiscoveryConversationInstructions } from "../src/analyst/DiscoveryConversation";
import { DocumentGenerator } from "../src/analyst/DocumentGenerator";
import type { RequirementsSummary } from "../src/analyst/RequirementsTypes";

test("new projects start with all expensive-miss checks visible", () => {
  const readiness = createEmptyDiscoveryReadiness();

  assert.deepEqual(
    readiness.sections.map((section) => section.key),
    EXPENSIVE_MISS_CHECKS.map((check) => check.key)
  );
  assert.equal(assessDiscoveryReadiness(readiness).expensiveMisses.length, 5);
});

test("unresolved expensive misses reduce readiness confidence", () => {
  const readiness = mergeDiscoveryReadiness(createEmptyDiscoveryReadiness(), {
    status: "in_progress",
    confidence: 0.9,
  });
  const assessment = assessDiscoveryReadiness(readiness, 0.7);

  assert.equal(assessment.shouldWarn, true);
  assert.ok(assessment.confidence < 0.9);
  assert.ok(
    assessment.openQuestions.some((question) =>
      question.includes("Which roles may view")
    )
  );
});

test("completed expensive-miss checks no longer appear as unresolved", () => {
  const sections = [
    ...EXPENSIVE_MISS_CHECKS.map((check) => ({
      key: check.key,
      status: "ready" as const,
      confidence: 0.9,
    })),
    { key: "business_context", status: "ready" as const, confidence: 0.9 },
  ];
  const readiness = mergeDiscoveryReadiness(createEmptyDiscoveryReadiness(), {
    status: "ready",
    confidence: 0.9,
    sections,
  });
  const assessment = assessDiscoveryReadiness(readiness, 0.7);

  assert.deepEqual(assessment.expensiveMisses, []);
  assert.equal(assessment.shouldWarn, false);
});

test("conversation control asks targeted expensive-miss questions", () => {
  const instructions = formatDiscoveryConversationInstructions(
    createEmptyDiscoveryReadiness()
  );

  assert.match(instructions, /Permissions and access/);
  assert.match(instructions, /delay, decline, or delegation/);
  assert.match(instructions, /sources of truth/);
  assert.match(instructions, /measures, filters, format, schedule/);
});

test("generated requirements call out unresolved expensive categories", () => {
  const readiness = createEmptyDiscoveryReadiness();
  const base: RequirementsSummary = {
    businessContext: {},
    primaryGoal: "Reduce referral delays",
    secondaryGoals: [],
    currentTools: [],
    mainActors: [],
    painPoints: [],
    dataEntities: [],
    candidateModules: [],
    nonFunctionalNeeds: [],
    risksAndConstraints: [],
    assumptions: [],
    openQuestions: [],
    uploadedDocuments: [],
    workflowDiagram: "flowchart TD",
  };
  const requirements = includeExpensiveMissContext(base, readiness);
  const markdown = new DocumentGenerator().generateRequirementsMarkdown(
    requirements
  );

  assert.equal(requirements.expensiveMisses.length, 5);
  assert.match(markdown, /## Expensive Gaps to Resolve/);
  assert.match(markdown, /Permissions and access/);
  assert.match(markdown, /Reporting and exports/);
});
