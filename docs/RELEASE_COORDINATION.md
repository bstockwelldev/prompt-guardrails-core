# Multi-repo release coordination

This records the **adopted** strategy for shipping `prompt-guardrails-core` and related consumers.

## Decision (active)

1. **Docs-first for shared libraries** — README, ROLLOUT, and CHANGELOG must match the published `package.json` version before tagging or npm publish.
2. **Ordered consumer bumps** — After a library release, bump explicit semver ranges in apps that want to advertise compatibility (e.g. `^1.1.0` in `package.json`); `^1.0.0` still resolves to 1.1.x but explicit ranges reduce confusion.
3. **Non-consumers** — Repos that do not depend on the package are **out of scope** for coordinated library releases.

## Rationale

Keeps install examples copy-pasteable, avoids README/ROLLOUT drift (e.g. `^1.0.1` after `1.1.0` shipped), and separates **library trains** from **content sites** on early `0.x` versions.
