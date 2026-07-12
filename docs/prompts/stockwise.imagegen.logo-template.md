# stockwise.imagegen.logo-template

- owner: bstockwelldev
- purpose: High-fidelity logo generation from brand description + optional asset/UI references
- prompt_type: template
- version: v1.1.0
- targets: chatgpt-gpt-image, gemini-ai-studio-imagen

This is a reference prompt template for image-generation logo requests. It is not
wired into this package's runtime, policy, or validation code — it is kept here
as documentation for reuse and as a source of test fixtures if guardrails
coverage for this prompt is added later.

## Variable schema

| Variable | Type | Required | Trust | Notes |
| --- | --- | --- | --- | --- |
| `MODE` | enum | yes | trusted config | `interactive` \| `direct`; interactive = intake interview before generation, direct = all params pre-filled |
| `APP_STATUS` | enum | no | user input | `deployed` \| `in-development` \| `prototype-only` \| `concept-only`; filled during interactive intake |
| `BRAND_NAME` | string | yes | user input | |
| `BRAND_DESCRIPTOR` | string | yes | user input | one-line what-it-is, e.g. "SaaS tool for tabletop game designers" |
| `LOGO_TYPE` | enum | yes | trusted config | `wordmark` \| `lettermark` \| `pictorial mark` \| `abstract mark` \| `combination mark` \| `emblem` \| `mascot` |
| `STYLE_DIRECTION` | string | yes | user input | e.g. "flat geometric minimalism", "retro terminal / CRT phosphor", "90s SGI workstation" |
| `MOOD_KEYWORDS` | string[] | yes | user input | 3-5 adjectives, e.g. precise, playful, trustworthy |
| `PRIMARY_COLOR` | hex | yes | trusted config | |
| `SECONDARY_COLOR` | hex | no | trusted config | |
| `ACCENT_COLOR` | hex | no | trusted config | |
| `BACKGROUND` | enum | yes | trusted config | `transparent` \| `white` \| `dark` \| `#hex` |
| `TYPOGRAPHY_STYLE` | string | no | user input | only for wordmark/combination, e.g. "geometric sans, tight tracking" |
| `ICON_MOTIF` | string | no | user input | core symbol concept, e.g. "d20 fused with a blueprint grid" |
| `ASSET_CONTEXT` | string | no | third-party document | describes attached UI/assets to match: palette, corner radii, line weights, existing marks |
| `COMPOSITION` | enum | no | trusted config | `centered square` \| `horizontal lockup` \| `stacked lockup`; default `centered square` |
| `DETAIL_LEVEL` | enum | no | trusted config | `ultra-minimal` \| `moderate` \| `detailed`; default `ultra-minimal` |
| `NEGATIVE_LIST` | string[] | no | trusted config | default: photorealism, 3D bevels, drop shadows, gradients unless specified, clip-art, watermarks, mockup scenes, extra text |

`output_contract`: single logo image; flat vector aesthetic; no text other than
`BRAND_NAME` (wordmark/combination only); centered on `BACKGROUND` with generous margin.

## Phase 0 — Interactive intake (MODE=interactive; paste this first)

```
<role>
You are a brand-identity intake interviewer. Before generating any image, you
must interrogate me about the app this logo represents. Be direct and probing —
challenge vague answers with one precise follow-up. Do not generate anything
until intake is complete.
</role>

<intake_procedure>
Step 1 — App reality check (always ask, one at a time):
  a. Does "{BRAND_NAME}" exist in code today, or is it a concept? If code:
     what stack, and what does the primary screen actually look like?
  b. Is it deployed to a live server/store? If yes, where do real users see the
     brand today (URL, app icon, login screen)? If no, what's the target surface?
  c. Record my answer as APP_STATUS: deployed | in-development | prototype-only
     | concept-only. If my answer is hand-wavy ("it's mostly done"), press once:
     "What specifically renders in a browser right now?"

Step 2 — Screenshot request (always ask):
  "Attach 1–3 screenshots of the app UI, app icon, or design mockups — actual
  screens preferred over mockups. If none exist, say 'no assets' and describe
  the intended look in one sentence."
  → If screenshots provided: extract palette (hex), corner-radius language,
    line weights, and typography feel into ASSET_CONTEXT, and confirm your
    reading with me before proceeding.
  → If no assets: set ASSET_CONTEXT=none and rely on Step 3.

Step 3 — Clarifying questions (ask 3–5, chosen for what's still unknown;
  skip any already answered):
  1. Who sees this logo first and where — landing page, app-store tile,
     invoice header? (drives COMPOSITION + DETAIL_LEVEL)
  2. Name three brands whose look you'd steal and one you'd never resemble.
     (drives STYLE_DIRECTION + NEGATIVE_LIST)
  3. Should the mark carry the name ({LOGO_TYPE}=wordmark/combination) or
     stand alone as a symbol? Why — will it ever appear at favicon size
     without text?
  4. What single concept must a stranger get in 2 seconds? (drives ICON_MOTIF)
  5. Hard color constraints — existing brand hex values, dark-mode
     requirement, print/monochrome use?

Step 4 — Confirm before generating:
  Echo back all filled parameters as a table: MODE, APP_STATUS, LOGO_TYPE,
  STYLE_DIRECTION, MOOD_KEYWORDS, ICON_MOTIF, colors, BACKGROUND, COMPOSITION,
  DETAIL_LEVEL, ASSET_CONTEXT summary, NEGATIVE_LIST.
  Ask: "Generate with these, or adjust?" Only on my approval, proceed to the
  generation prompt below with every {PARAM} substituted.
</intake_procedure>
```

## Phase 1 — Generation template (paste directly if MODE=direct, or auto-runs after intake)

```
<instructions>
Design a professional {LOGO_TYPE} logo for "{BRAND_NAME}" — {BRAND_DESCRIPTOR}.

Style: {STYLE_DIRECTION}. Mood: {MOOD_KEYWORDS}.
Core motif: {ICON_MOTIF}.
Composition: {COMPOSITION}, generous negative space, balanced optical weight,
scalable and legible at 32px favicon size and at billboard scale.
Detail level: {DETAIL_LEVEL} — clean flat vector aesthetic, uniform line weight,
crisp edges, deliberate geometry.

Color: primary {PRIMARY_COLOR}, secondary {SECONDARY_COLOR}, accent {ACCENT_COLOR}.
Background: {BACKGROUND}. Use flat solid fills; no more than 3 colors total.

Typography (wordmark/combination only): render "{BRAND_NAME}" in {TYPOGRAPHY_STYLE};
letterforms must be even, correctly spelled, and kerned. No other text anywhere.
</instructions>

<asset_context>
Match the provided reference assets/UI: {ASSET_CONTEXT}.
Inherit its palette, corner radius language, and line weight so the logo feels
native to the existing interface. (Omit this section if no assets.)
</asset_context>

<constraints>
Exclude: {NEGATIVE_LIST}.
Single logo only — no variations grid, no mockups, no branding-sheet layout.
Vector-style flat illustration, print-ready contrast, works in monochrome.
</constraints>
```

## Platform notes

- **ChatGPT (GPT Image)**: handles the tagged sections fine; ask for "transparent
  background PNG" explicitly if needed. Strong at text rendering — wordmarks
  are viable.
- **Gemini AI Studio (Imagen)**: flatten tags into paragraphs if results
  degrade; put style + color earliest in the prompt. Weaker text fidelity —
  prefer pictorial/abstract marks, or generate the mark and add type yourself.
  Set aspect ratio 1:1 in generation settings rather than in-prompt.
- **Both**: run 3-4 candidates per fill, then iterate with "keep composition,
  change only X."
- **Interactive mode**: works natively in ChatGPT (multi-turn + image upload).
  In Gemini AI Studio, run intake in a chat session with vision enabled, then
  paste the filled Phase 1 prompt into the image-generation model — Studio's
  image models don't hold the interview themselves.

## Test fixtures

**Valid fixture (Tabletop Studio example)**

`LOGO_TYPE=combination mark; STYLE_DIRECTION=flat geometric minimalism;
MOOD=[precise, playful, craftsman]; ICON_MOTIF=d20 fused with blueprint grid;
PRIMARY=#2B6CB0; BACKGROUND=transparent; TYPOGRAPHY_STYLE=geometric sans,
medium weight` → expect single flat combination mark, ≤3 colors, no mockup scene.

**Interactive fixture**

`MODE=interactive`; user answers "it's mostly built" in Step 1 → expect one
pressing follow-up ("What specifically renders in a browser right now?"), a
screenshot request, 3-5 non-redundant Step 3 questions, and a confirmation
table before any image is generated. Failure = generating an image before
Step 4 approval.

**Misuse fixture**

`BRAND_NAME="Nike-style swoosh brand"; ICON_MOTIF="the Nike swoosh"` → reject/
redirect: template must not reproduce existing trademarks; require an
original motif.
