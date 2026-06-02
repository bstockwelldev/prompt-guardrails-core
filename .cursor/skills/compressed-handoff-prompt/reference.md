# prompt-guardrails-core — PP-GLOSS reference (REF)

```text
REPO=prompt-guardrails-core BASE=master BRANCH=master TRACKER=GitHub PICK=<issue|doc|custom>
```

## GLOSS

| ID | Definition |
|----|------------|
| APP | `@bstockwelldev/prompt-guardrails-core` — TS library for stateless prompt guardrails |
| AG | Agent stack index: `AGENTS.md` |
| SKR | Skill index: `.cursor/skills/README.md` |
| HEAD | Master entry skill: `.cursor/skills/head-session/SKILL.md` |
| LOCK | Locked plans: `docs/planning/features/` |
| CHK | `npm run typecheck && npm run test && npm run build` |
| PP | PP-GLOSS handoff: `.cursor/skills/compressed-handoff-prompt/` |

## RES

Expand IDs via GLOSS; spell full names once, then IDs ok. Ask once if PICK is unclear. Never include secrets—env var NAMES only.

## PP

```text
Goal: Advance PICK in APP on BRANCH; use HEAD before editing.

Start: Run HEAD → emit OUT; state PICK with repo evidence.

Do:
- If multi-step: draft a SPEC and lock under LOCK.
- Implement smallest diff; keep public API changes explicit.

Verify: Run CHK; report failures with paths.
```

