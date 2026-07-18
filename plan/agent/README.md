# NiagaAI Agent Orchestration Plan Pack

Use the files in numerical order. Give Codex one session plan at a time from the
repository root on the `dev` branch.

Recommended Codex prompt:

```text
Read AGENTS.md and all documentation required by this plan. Then execute
<PLAN_FILE> against the current dev branch. Inspect the current implementation
first and adapt all proposed fields, filenames, schemas, migrations, and tests
to the repository's actual conventions. Do not blindly implement conceptual
examples. Keep the existing bot working, run all required checks, and write the
requested implementation decision log.
```

Read `00_ORCHESTRATION_MASTER_PLAN.md` for context, but do not ask Codex to
implement every session in one run.
