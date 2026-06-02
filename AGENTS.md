# AGENTS.md (prompt-guardrails-core)

## Minimal public-safe agent stack

| Entry | Path |
| --- | --- |
| **HEAD** | `.cursor/skills/head-session/SKILL.md` |
| **SKR** | `.cursor/skills/README.md` |
| **PP** | `.cursor/skills/compressed-handoff-prompt/SKILL.md` |

## Repo notes

- Default branch: `master`
- Verification commands depend on the change; use `package.json` scripts as the source of truth.

## Public-safe policy (what to keep out of this repo)

- **No tracker coupling by default**: avoid Linear, Jira, or private tracker assumptions in committed agent docs/skills.
- **No private REF docs**: do not commit “my workspace / my org” reference packs; keep PP-GLOSS templates generic.
- **No mandatory change-plan workflow** unless the user explicitly asks for it in this repo.

