# Changelog

## 1.1.0

- Add `quoteAppearsInSource` and `filterInsightsBySource` in `evidence` helpers for substring grounding checks.
- Extend `validatePromptOutput` with optional `afterParse` (domain validation → `output_domain_validation_failed`) and `leakagePatterns` / `includeDefaultLeakagePatterns`.
- Add `output_domain_validation_failed` to `PromptRefusalReason`.
- Add `invokeSequential` for ordered multi-pass flows with aggregated telemetry.

## 1.0.1

- Prior releases; see git history.
