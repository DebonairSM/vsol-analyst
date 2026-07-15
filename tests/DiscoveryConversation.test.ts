import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDiscoveryConversationAction,
  continueDiscoveryConversation,
  formatDiscoveryConversationInstructions,
} from "../src/analyst/DiscoveryConversation";
import { createEmptyDiscoveryReadiness } from "../src/analyst/DiscoveryReadiness";
import type { LLMProvider } from "../src/llm/LLMProvider";

test("repeated clarification attempts are tracked for the same discovery item", () => {
  const first = applyDiscoveryConversationAction(
    createEmptyDiscoveryReadiness(),
    {
      type: "ask",
      itemKey: "approval-owner",
      question: "Who gives final approval?",
      knownContext: ["Managers review exceptions."],
    }
  );
  const second = applyDiscoveryConversationAction(first.readiness, {
    type: "ask",
    itemKey: "approval-owner",
    question: "Which role makes the last approval decision?",
    knownContext: ["Requests begin with a supervisor."],
  });

  assert.equal(second.readiness.clarificationItems.length, 1);
  assert.deepEqual(second.readiness.clarificationItems[0], {
    key: "approval-owner",
    question: "Who gives final approval?",
    knownContext: [
      "Managers review exceptions.",
      "Requests begin with a supervisor.",
    ],
    followUps: [
      "Who gives final approval?",
      "Which role makes the last approval decision?",
    ],
    attempts: 2,
    status: "asking",
  });
});

test("a fourth follow-up is not asked and the unresolved item is parked with context", () => {
  let readiness = createEmptyDiscoveryReadiness();
  const questions = [
    "Who gives final approval?",
    "Which role makes the last approval decision?",
    "Whose decision lets the request proceed?",
  ];

  for (const question of questions) {
    readiness = applyDiscoveryConversationAction(readiness, {
      type: "ask",
      itemKey: "approval-owner",
      question,
      knownContext: ["Supervisors review requests first."],
    }).readiness;
  }

  const result = applyDiscoveryConversationAction(readiness, {
    type: "ask",
    itemKey: "approval-owner",
    question: "Who has approval authority?",
    knownContext: ["The final approver is still unknown."],
  });

  assert.equal(result.parked, true);
  assert.equal(result.readiness.clarificationItems[0].attempts, 3);
  assert.equal(result.readiness.clarificationItems[0].status, "parked");
  assert.deepEqual(result.readiness.clarificationItems[0].followUps, questions);
  assert.deepEqual(result.readiness.openQuestions, [
    "Who gives final approval? Known context: Supervisors review requests first. The final approver is still unknown.",
  ]);
});

test("a later answer resolves a parked item and removes its open question", () => {
  let readiness = createEmptyDiscoveryReadiness();
  for (const question of [
    "Who gives final approval?",
    "Which role makes the last approval decision?",
    "Whose decision lets the request proceed?",
    "Who has approval authority?",
  ]) {
    readiness = applyDiscoveryConversationAction(readiness, {
      type: "ask",
      itemKey: "approval-owner",
      question,
      knownContext: ["Supervisors review requests first."],
    }).readiness;
  }

  const result = applyDiscoveryConversationAction(readiness, {
    type: "resolve",
    itemKey: "approval-owner",
    answer: "The operations director gives final approval.",
  });

  assert.equal(result.readiness.clarificationItems[0].status, "resolved");
  assert.equal(
    result.readiness.clarificationItems[0].resolution,
    "The operations director gives final approval."
  );
  assert.deepEqual(result.readiness.openQuestions, []);
});

test("chat returns client-safe prose while applying its structured discovery action", async () => {
  let requestedJson = false;
  const llm: LLMProvider = {
    async chat(options) {
      requestedJson = options.responseFormat === "json";
      return JSON.stringify({
        reply: "Which role gives the final approval?",
        discoveryAction: {
          type: "ask",
          itemKey: "approval-owner",
          question: "Which role gives the final approval?",
          knownContext: ["Supervisors review requests first."],
        },
      });
    },
  };

  const result = await continueDiscoveryConversation(
    llm,
    [{ role: "user", content: "It depends." }],
    createEmptyDiscoveryReadiness()
  );

  assert.equal(requestedJson, true);
  assert.equal(result.reply, "Which role gives the final approval?");
  assert.equal(result.readiness.clarificationItems[0].attempts, 1);
});

test("chat replaces an attempted fourth phrasing with a parking response", async () => {
  let readiness = createEmptyDiscoveryReadiness();
  for (const question of [
    "Who gives final approval?",
    "Which role makes the last approval decision?",
    "Whose decision lets the request proceed?",
  ]) {
    readiness = applyDiscoveryConversationAction(readiness, {
      type: "ask",
      itemKey: "approval-owner",
      question,
    }).readiness;
  }

  const llm: LLMProvider = {
    async chat() {
      return JSON.stringify({
        reply: "Who has approval authority?",
        discoveryAction: {
          type: "ask",
          itemKey: "approval-owner",
          question: "Who has approval authority?",
        },
      });
    },
  };

  const result = await continueDiscoveryConversation(
    llm,
    [{ role: "user", content: "I am still not sure." }],
    readiness
  );

  assert.match(result.reply, /park.*open question/i);
  assert.doesNotMatch(result.reply, /Who has approval authority/);
  assert.equal(result.readiness.clarificationItems[0].status, "parked");
});

test("an unclear response after the third phrasing is parked even when the model emits no action", async () => {
  let readiness = createEmptyDiscoveryReadiness();
  for (const question of [
    "Who gives final approval?",
    "Which role makes the last approval decision?",
    "Whose decision lets the request proceed?",
  ]) {
    readiness = applyDiscoveryConversationAction(readiness, {
      type: "ask",
      itemKey: "approval-owner",
      question,
    }).readiness;
  }

  const llm: LLMProvider = {
    async chat() {
      return JSON.stringify({
        reply: "Let’s move on to exception handling.",
        discoveryAction: { type: "none" },
      });
    },
  };

  const result = await continueDiscoveryConversation(
    llm,
    [{ role: "user", content: "I still do not know." }],
    readiness
  );

  assert.match(result.reply, /park.*open question/i);
  assert.equal(result.readiness.clarificationItems[0].status, "parked");
  assert.equal(result.readiness.openQuestions.length, 1);
});

test("clarification control explicitly includes ubiquitous-language gaps", () => {
  const instructions = formatDiscoveryConversationInstructions(
    createEmptyDiscoveryReadiness()
  );

  assert.match(instructions, /ubiquitous-language clarification questions/i);
  assert.match(instructions, /term:<normalized-term>/i);
});
