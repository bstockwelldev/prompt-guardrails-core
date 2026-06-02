---
name: change-plan-orchestrator
description: Phase-gated workflow for prompt-guardrails-core changes.
---

# Change plan orchestrator (prompt-guardrails-core)

```text
Phase A  PLAN     -> feature-change-plan
Phase D  LOCK     -> feature-change-spec-lock
Phase E  BUILD    -> feature-change-implement (CHK)
```

Hard stop: no Phase E without a locked spec unless user explicitly waives lock.

