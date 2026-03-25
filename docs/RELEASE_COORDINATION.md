# Multi-repo release coordination

This records the **adopted** strategy for shipping `@bstockwelldev/prompt-guardrails-core` and related consumers (see multi-repo release readiness planning).

## Decision (active)

1. **Docs-first for shared libraries** — README, ROLLOUT, and CHANGELOG must match the published `package.json` version before tagging or npm publish.
2. **Ordered consumer bumps** — After a library release, bump explicit semver ranges in apps that want to advertise compatibility (e.g. `^1.1.0` in `package.json`); `^1.0.0` still resolves to 1.1.x but explicit ranges reduce confusion.
3. **Portfolio / marketing sites** — Repos such as Stockwise Productions web are **out of scope** for coordinated npm library cuts unless they start depending on published packages with semver gates.

## Rationale

Keeps install examples copy-pasteable, avoids README/ROLLOUT drift (e.g. `^1.0.1` after `1.1.0` shipped), and separates **library trains** from **content sites** on early `0.x` versions.
