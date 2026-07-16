# Blind Generation Benchmark

`benchmark-set.v1.json` is the frozen acceptance set for the Lovable workflow. Do not edit version 1 after implementation work starts; create a new version instead.

## Isolation

- Generation agents receive a normal agent-ready source archive, one task prompt, and only that task's declared input files.
- They do not receive this directory, hidden acceptance criteria, score definitions, earlier runs, or correction history.
- Evaluators record first-pass results before giving feedback.
- All names, records, URLs, and identifiers in benchmark inputs are fictional.

## Run Contract

1. Validate the frozen set and checksum.
2. Create a fresh source archive and workspace per task.
3. Extract the task prompt and copy only its declared inputs into the workspace.
4. Start a fresh independent generation agent with no conversation history.
5. Preserve the first delivery before evaluation or correction.
6. Score binary gates, rated dimensions, timing, and correction rounds.
7. Fix recurring workflow defects generally; never expose hidden criteria or patch an example solely for one task.

Evaluator commands:

```bash
npx tsx benchmarks/prepare-run.mts --run-id <run-id>
npx tsx benchmarks/evaluate-gates.mts <run-id> [task-id]
npx tsx benchmarks/validate-results.mts <run-id>
```

Run artifacts live under `.tmp/benchmark-runs/<run-id>` and are excluded from agent source archives. `evaluate-gates` preserves first-pass delivery and screenshot evidence before running independent gates.

`scorecard.schema.json` defines the persisted run record. A first pass is usable only when every binary gate passes, every rated dimension scores at least 3, the rated total is at least 40/50, and the evaluator marks the ZIP upload-ready.
