import assert from "node:assert/strict";
import test from "node:test";
import { DocumentGenerator } from "../src/analyst/DocumentGenerator";
import { SYSTEM_PROMPT_EXTRACTOR } from "../src/analyst/prompts";
import type { RequirementsSummary } from "../src/analyst/RequirementsTypes";

function requirements(
  overrides: Partial<RequirementsSummary> = {}
): RequirementsSummary {
  return {
    businessContext: { companyName: "Northwind Bakery" },
    clientSummary:
      "Northwind Bakery wants one dependable way to approve wholesale orders before production begins.",
    confirmedFacts: ["Wholesale orders currently arrive by email."],
    primaryGoal: "Reduce delays in wholesale order approval",
    secondaryGoals: [],
    currentTools: ["Email"],
    mainActors: [{ name: "Bakery Manager", description: "Approves wholesale orders." }],
    painPoints: [],
    dataEntities: [{ name: "Wholesale Order", fields: ["Customer", "Delivery date"] }],
    candidateModules: [
      {
        name: "Order Approval",
        description: "Lets the Bakery Manager approve an order.",
        priority: "must-have",
      },
    ],
    nonFunctionalNeeds: ["Works on a phone"],
    risksAndConstraints: [],
    assumptions: ["The Bakery Manager is the final approver."],
    openQuestions: ["Who approves orders when the Bakery Manager is away?"],
    uploadedDocuments: [],
    workflowDiagram: "flowchart TD",
    ...overrides,
  };
}

test("requirements lead with a concise client summary and separated review status", () => {
  const markdown = new DocumentGenerator().generateRequirementsMarkdown(
    requirements()
  );

  assert.match(markdown, /^# Requirements for Business Review/);
  assert.ok(markdown.indexOf("## Client Summary") < markdown.indexOf("## Primary Goal"));
  assert.match(markdown, /## Confirmed Facts\n- Wholesale orders currently arrive by email\./);
  assert.match(markdown, /## Assumptions\n- The Bakery Manager is the final approver\./);
  assert.match(markdown, /## Open Questions\n- Who approves orders/);
});

test("detailed section labels use client-friendly language", () => {
  const markdown = new DocumentGenerator().generateRequirementsMarkdown(
    requirements()
  );

  assert.match(markdown, /## Information the Business Needs/);
  assert.match(markdown, /## Proposed Capabilities/);
  assert.match(markdown, /## Quality, Access, and Operating Needs/);
  assert.doesNotMatch(markdown, /## Data Entities and Structure/);
  assert.doesNotMatch(markdown, /## Non Functional Needs/);
});

test("legacy requirements receive a useful derived client summary", () => {
  const markdown = new DocumentGenerator().generateRequirementsMarkdown(
    requirements({ clientSummary: undefined })
  );

  assert.match(
    markdown,
    /Reduce delays in wholesale order approval\. The proposed first scope centers on Order Approval\./
  );
});

test("extractor explicitly prioritizes business language and evidence labels", () => {
  assert.match(SYSTEM_PROMPT_EXTRACTOR, /WRITE FOR CLIENT REVIEW FIRST/);
  assert.match(SYSTEM_PROMPT_EXTRACTOR, /plain business language/i);
  assert.match(SYSTEM_PROMPT_EXTRACTOR, /client's own confirmed terms/i);
  assert.match(SYSTEM_PROMPT_EXTRACTOR, /confirmedFacts contains only explicit evidence/);
  assert.match(SYSTEM_PROMPT_EXTRACTOR, /technical.*clarify scope or constraints/i);
});
