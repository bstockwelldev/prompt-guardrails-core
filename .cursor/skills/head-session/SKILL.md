---
name: head-session
description: >-
  prompt-guardrails-core HEAD entry: kickoff OUT, pick scope, optional PP-GLOSS
  handoff. Use for /head-session or /head.
disable-model-invocation: true
---

# Head session (prompt-guardrails-core)

## Context

Single entry for **ground → pick → plan → (handoff)** before implementation.

## ENFORCEMENT

- Emit kickoff **OUT** before editing code unless user says skip.
- No secrets in outputs.

## Step 1 — Session kickoff

1. Read and apply: [routing.md](../session-kickoff/routing.md).
2. Emit OUT (repo purpose, structure hints, key scripts, constraints).

## Step 2 — Scope pick

State PICK with repo evidence (file paths, scripts, docs).

## Step 3 — PP-GLOSS (optional)

Use `.cursor/skills/compressed-handoff-prompt/` to emit a cold-session paste block.

