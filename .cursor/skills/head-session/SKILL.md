---
name: head-session
description: >-
  prompt-guardrails-core HEAD entry: kickoff OUT, pick scope, route change-plan,
  optional PP-GLOSS handoff. Use for /head-session or /head.
disable-model-invocation: true
---

# Head session (prompt-guardrails-core)

## Context

Single entry for **ground → pick → plan → (handoff)** before implementation.

## ENFORCEMENT

- Emit kickoff **OUT** before editing code unless user says skip.
- No implementation Phase E without a locked spec unless explicitly waived.
- No secrets in outputs.

## Step 1 — Session kickoff

1. Load user baseline: `%USERPROFILE%\.cursor\skills\session-kickoff\SKILL.md`.
2. Merge repo overlay: [routing.md](../session-kickoff/routing.md).
3. Emit OUT.

## Step 2 — Scope pick

State PICK with repo evidence (file paths, scripts, docs).

## Step 3 — Change plan (optional)

Use `.cursor/skills/change-plan-orchestrator/SKILL.md` for phase map A–F.

## Step 4 — PP-GLOSS (optional)

Use `.cursor/skills/compressed-handoff-prompt/` to emit a cold-session paste block.

