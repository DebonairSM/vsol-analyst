import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  formatEvaluationPacket,
  loadEvaluationFixture,
  validateEvaluationFixture,
} from "../src/evaluations/EvaluationFixture";

const fixturePath = path.resolve(
  process.cwd(),
  "evaluations/fixtures/normal-messy-project.json"
);

test("normal messy fixture is valid and includes realistic uncertainty", () => {
  const fixture = loadEvaluationFixture(fixturePath);
  const clientText = fixture.transcript
    .filter((turn) => turn.role === "client")
    .map((turn) => turn.content)
    .join(" ");

  assert.ok(fixture.artifacts.some((artifact) => artifact.type === "spreadsheet"));
  assert.match(clientText, /job.*cases or referrals/i);
  assert.match(clientText, /somebody approves/i);
  assert.match(clientText, /monthly report/i);
  assert.match(clientText, /QuickBooks/i);
  assert.equal(fixture.expectedMinimum.readiness.shouldWarn, true);
  assert.ok(fixture.expectedMinimum.openQuestions.length >= 6);
});

test("fixture keeps facts, assumptions, and questions distinct", () => {
  const fixture = loadEvaluationFixture(fixturePath);

  assert.ok(fixture.expectedMinimum.confirmedFacts.length > 0);
  assert.ok(fixture.expectedMinimum.assumptions.length > 0);
  assert.ok(fixture.expectedMinimum.openQuestions.length > 0);
  assert.ok(
    fixture.expectedMinimum.openQuestions.some((question) =>
      question.includes("QuickBooks")
    )
  );
});

test("fixture runner format produces a usable manual evaluation packet", () => {
  const packet = formatEvaluationPacket(loadEvaluationFixture(fixturePath));

  assert.match(packet, /## Client conversation/);
  assert.match(packet, /## Supplied files/);
  assert.match(packet, /referral-tracker\.xlsx/);
  assert.match(packet, /## Minimum acceptable result/);
  assert.match(packet, /Maximum acceptable confidence: 69%/);
});

test("validator rejects a fixture without spreadsheet-like evidence", () => {
  assert.throws(
    () =>
      validateEvaluationFixture({
        id: "broken",
        title: "Broken",
        purpose: "Demonstrate validation",
        selectedMode: "Quick Scope",
        transcript: Array.from({ length: 4 }, () => ({
          role: "client",
          content: "Some input",
        })),
        artifacts: [],
        expectedMinimum: {},
      }),
    /artifacts must include/
  );
});
