import assert from "node:assert/strict";
import test from "node:test";
import { DocumentGenerator } from "../src/analyst/DocumentGenerator";
import { RequirementsExtractor } from "../src/analyst/RequirementsExtractor";
import type { RequirementsSummary } from "../src/analyst/RequirementsTypes";
import {
  includeUbiquitousLanguageContext,
  normalizeBusinessTerms,
} from "../src/analyst/UbiquitousLanguage";
import {
  SYSTEM_PROMPT_ANALYST,
  SYSTEM_PROMPT_EXTRACTOR,
  SYSTEM_PROMPT_FLOWCHART_GENERATOR,
  SYSTEM_PROMPT_REFINER,
  SYSTEM_PROMPT_STORY_GENERATOR,
  SYSTEM_PROMPT_STORY_REFINER,
} from "../src/analyst/prompts";
import type { ChatMessage, LLMProvider } from "../src/llm/LLMProvider";

function requirements(
  overrides: Partial<RequirementsSummary> = {}
): RequirementsSummary {
  return {
    businessContext: {},
    primaryGoal: "Track Service Cases",
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
    ...overrides,
  };
}

test("business terms are normalized and deduplicated by preferred term", () => {
  const terms = normalizeBusinessTerms([
    {
      preferredTerm: " Service Case ",
      definition: " A customer request handled by support. ",
      aliases: ["Ticket", "ticket", "Service Case"],
      status: "confirmed",
      sources: ["Chat", "Chat", "cases.xlsx"],
    },
    {
      preferredTerm: "service case",
      definition: "Duplicate",
      status: "confirmed",
    },
  ]);

  assert.deepEqual(terms, [
    {
      preferredTerm: "Service Case",
      definition: "A customer request handled by support.",
      aliases: ["Ticket"],
      status: "confirmed",
      sources: ["Chat", "cases.xlsx"],
    },
  ]);
});

test("ambiguous terms remain unconfirmed and become open questions", () => {
  const result = includeUbiquitousLanguageContext(
    requirements({
      openQuestions: ["Who owns intake?"],
      ubiquitousLanguage: [
        {
          preferredTerm: "Case",
          definition: "",
          aliases: [],
          status: "needs-clarification",
          sources: ["Chat"],
        },
        {
          preferredTerm: "Complete",
          definition: "A case has passed final review.",
          aliases: ["Done"],
          status: "needs-clarification",
          sources: ["status-codes.xlsx"],
          clarificationQuestion: "Does Complete mean reviewed or merely submitted?",
        },
      ],
    })
  );

  assert.deepEqual(result.openQuestions, [
    "Who owns intake?",
    'What does "Case" mean in your business?',
    "Does Complete mean reviewed or merely submitted?",
  ]);
  assert.equal(
    result.ubiquitousLanguage[0].clarificationQuestion,
    'What does "Case" mean in your business?'
  );
});

test("requirements markdown always includes the key terms review section", () => {
  const docs = new DocumentGenerator();
  const withTerms = docs.generateRequirementsMarkdown(
    requirements({
      ubiquitousLanguage: [
        {
          preferredTerm: "Service Case",
          definition: "A customer request handled by support.",
          aliases: ["Ticket"],
          status: "confirmed",
          sources: ["Chat", "cases.xlsx"],
        },
      ],
    })
  );
  const legacy = docs.generateRequirementsMarkdown(requirements());

  assert.match(withTerms, /## Ubiquitous Language \/ Key Terms/);
  assert.match(withTerms, /### Service Case/);
  assert.match(withTerms, /\*\*Status:\*\* Confirmed/);
  assert.match(withTerms, /\*\*Also heard as:\*\* Ticket/);
  assert.match(withTerms, /\*\*Sources:\*\* Chat, cases\.xlsx/);
  assert.match(legacy, /No business-specific terms have been recorded yet\./);
});

test("requirements extraction preserves terminology questions", async () => {
  let messages: ChatMessage[] = [];
  const llm: LLMProvider = {
    async chat(options) {
      messages = options.messages;
      return JSON.stringify(
        requirements({
          ubiquitousLanguage: [
            {
              preferredTerm: "Job",
              definition: "",
              aliases: [],
              status: "needs-clarification",
              sources: ["Chat", "jobs.xlsx"],
              clarificationQuestion: "Is a Job a customer order or a work visit?",
            },
          ],
        })
      );
    },
  };

  const result = await new RequirementsExtractor(llm).extractFromTranscript([
    { role: "user", content: "Our upload calls each row a Job." },
  ]);

  assert.match(messages[0].content as string, /chat and uploaded-file summaries/i);
  assert.deepEqual(result.openQuestions, [
    "Is a Job a customer order or a work visit?",
  ]);
});

test("all generation stages are instructed to use confirmed preferred terms", () => {
  assert.match(SYSTEM_PROMPT_ANALYST("Alex"), /multiple business meanings/i);
  assert.match(SYSTEM_PROMPT_EXTRACTOR, /confirmed preferredTerm values/i);
  assert.match(SYSTEM_PROMPT_REFINER, /Preserve ubiquitousLanguage entries/i);
  assert.match(SYSTEM_PROMPT_STORY_GENERATOR, /preferredTerm values verbatim/i);
  assert.match(SYSTEM_PROMPT_STORY_REFINER, /preferredTerm values verbatim/i);
  assert.match(SYSTEM_PROMPT_FLOWCHART_GENERATOR, /preferredTerm values verbatim/i);
});
