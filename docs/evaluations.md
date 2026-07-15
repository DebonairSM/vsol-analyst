# Sunny evaluation fixtures

Evaluation fixtures preserve realistic client input together with a minimum acceptable result. They are designed for human review now and can be consumed by an automated scorer later.

Run the normal messy project fixture from the repository root:

```powershell
npm run eval:fixture -- normal-messy-project
```

The command validates the fixture and prints a review packet containing the conversation, supplied spreadsheet evidence, required open questions, required capabilities, and the expected readiness warning. A reviewer can paste the conversation and artifact details into Sunny, then compare the generated requirements with the minimum acceptable result.

Fixtures intentionally distinguish confirmed facts from assumptions and unresolved questions. A result should fail review if it invents certainty, omits the readiness warning, or overlooks the listed expensive gaps.
