import assert from "node:assert/strict";
import test from "node:test";
import { RequirementsExtractor } from "../src/analyst/RequirementsExtractor";
import { ChatMessage, LLMProvider } from "../src/llm/LLMProvider";
import {
  buildDiscoveryReadinessPersistenceData,
  mergeDiscoveryReadiness,
  normalizeDiscoveryReadiness,
  withDiscoveryReadinessContext,
} from "../src/analyst/DiscoveryReadiness";

test("projects without discovery readiness load with a safe default", () => {
  assert.deepEqual(normalizeDiscoveryReadiness(null), {
    version: 1,
    status: "not_started",
    confidence: 0,
    attempts: 0,
    sections: [],
    assumptions: [],
    openQuestions: [],
  });
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
