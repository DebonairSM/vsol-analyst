import path from "node:path";
import {
  formatEvaluationPacket,
  loadEvaluationFixture,
} from "../src/evaluations/EvaluationFixture";

const fixtureName = process.argv[2] ?? "normal-messy-project";
if (!/^[a-z0-9-]+$/i.test(fixtureName)) {
  throw new Error("Fixture name may contain only letters, numbers, and hyphens.");
}

const fixturePath = path.resolve(
  process.cwd(),
  "evaluations",
  "fixtures",
  `${fixtureName}.json`
);
const fixture = loadEvaluationFixture(fixturePath);

process.stdout.write(`${formatEvaluationPacket(fixture)}\n`);
