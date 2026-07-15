import fs from "node:fs";

export interface EvaluationTranscriptTurn {
  role: "client" | "analyst";
  content: string;
}

export interface EvaluationArtifact {
  filename: string;
  type: "spreadsheet" | "document" | "image";
  description: string;
  columns?: string[];
  sampleRows?: Array<Record<string, string | number | null>>;
}

export interface EvaluationFixture {
  id: string;
  title: string;
  purpose: string;
  selectedMode: string;
  transcript: EvaluationTranscriptTurn[];
  artifacts: EvaluationArtifact[];
  expectedMinimum: {
    clientSummaryMustMention: string[];
    confirmedFacts: string[];
    assumptions: string[];
    openQuestions: string[];
    requiredCapabilities: string[];
    readiness: {
      shouldWarn: boolean;
      maximumConfidence: number;
      missingOrLowConfidenceAreas: string[];
    };
  };
}

export function loadEvaluationFixture(filePath: string): EvaluationFixture {
  const fixture = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  validateEvaluationFixture(fixture);
  return fixture;
}

export function validateEvaluationFixture(
  value: unknown
): asserts value is EvaluationFixture {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Evaluation fixture must be an object.");
  }

  const fixture = value as Partial<EvaluationFixture>;
  requireText(fixture.id, "id");
  requireText(fixture.title, "title");
  requireText(fixture.purpose, "purpose");
  requireText(fixture.selectedMode, "selectedMode");

  if (!Array.isArray(fixture.transcript) || fixture.transcript.length < 4) {
    throw new Error("transcript must contain at least four realistic turns.");
  }
  if (!Array.isArray(fixture.artifacts) || fixture.artifacts.length === 0) {
    throw new Error("artifacts must include at least one supplied file.");
  }
  if (!fixture.artifacts.some((artifact) => artifact.type === "spreadsheet")) {
    throw new Error("artifacts must include spreadsheet-like data.");
  }

  const expected = fixture.expectedMinimum;
  if (!expected || typeof expected !== "object") {
    throw new Error("expectedMinimum is required.");
  }
  for (const key of [
    "clientSummaryMustMention",
    "confirmedFacts",
    "assumptions",
    "openQuestions",
    "requiredCapabilities",
  ] as const) {
    if (!Array.isArray(expected[key]) || expected[key].length === 0) {
      throw new Error(`expectedMinimum.${key} must not be empty.`);
    }
  }

  if (
    !expected.readiness ||
    expected.readiness.shouldWarn !== true ||
    typeof expected.readiness.maximumConfidence !== "number" ||
    expected.readiness.maximumConfidence < 0 ||
    expected.readiness.maximumConfidence > 1 ||
    !Array.isArray(expected.readiness.missingOrLowConfidenceAreas) ||
    expected.readiness.missingOrLowConfidenceAreas.length === 0
  ) {
    throw new Error("expectedMinimum.readiness must define a warning and confidence ceiling.");
  }
}

export function formatEvaluationPacket(fixture: EvaluationFixture): string {
  const lines = [
    `# ${fixture.title}`,
    "",
    fixture.purpose,
    "",
    `**Discovery mode:** ${fixture.selectedMode}`,
    "",
    "## Client conversation",
    "",
    ...fixture.transcript.flatMap((turn) => [
      `**${turn.role === "client" ? "Client" : "Sunny"}:** ${turn.content}`,
      "",
    ]),
    "## Supplied files",
    "",
    ...fixture.artifacts.flatMap((artifact) => [
      `### ${artifact.filename}`,
      artifact.description,
      artifact.columns?.length ? `Columns: ${artifact.columns.join(", ")}` : "",
      artifact.sampleRows?.length
        ? `Sample rows: ${JSON.stringify(artifact.sampleRows, null, 2)}`
        : "",
      "",
    ]),
    "## Minimum acceptable result",
    "",
    `- Readiness warning required: ${fixture.expectedMinimum.readiness.shouldWarn}`,
    `- Maximum acceptable confidence: ${Math.round(
      fixture.expectedMinimum.readiness.maximumConfidence * 100
    )}%`,
    `- Missing or low-confidence areas: ${fixture.expectedMinimum.readiness.missingOrLowConfidenceAreas.join(", ")}`,
    "",
    "### Required open questions",
    ...fixture.expectedMinimum.openQuestions.map((question) => `- ${question}`),
    "",
    "### Required capabilities",
    ...fixture.expectedMinimum.requiredCapabilities.map((capability) => `- ${capability}`),
    "",
  ];

  return lines.filter((line, index) => line || lines[index - 1] !== "").join("\n");
}

function requireText(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string.`);
  }
}
