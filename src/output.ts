import type { OutputSchema } from './types.js';
import { PromptGuardrailsError } from './errors.js';

const FENCE_REGEX = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
const TRAILING_COMMA_REGEX = /,\s*([}\]])/g;
const DEFAULT_DISALLOWED_OUTPUT = [/password/i, /private key/i, /how to hack/i];

export type ValidatePromptOutputOptions<T> = {
  /** Extra leakage regexes; defaults are always applied unless you pass `includeDefaultLeakagePatterns: false`. */
  leakagePatterns?: RegExp[];
  /** When false, only `leakagePatterns` are used (must be non-empty). */
  includeDefaultLeakagePatterns?: boolean;
  /** Run after Zod parse succeeds; return failure to surface `output_domain_validation_failed`. */
  afterParse?: (data: T) => { ok: true } | { ok: false; message?: string };
};

export type ValidatePromptOutputFailureReason =
  | 'schema_invalid'
  | 'output_leakage_detected'
  | 'output_domain_validation_failed';

function resolveLeakagePatterns(
  options?: Pick<
    ValidatePromptOutputOptions<unknown>,
    'leakagePatterns' | 'includeDefaultLeakagePatterns'
  >,
): RegExp[] {
  const custom = options?.leakagePatterns ?? [];
  const includeDefault = options?.includeDefaultLeakagePatterns !== false;
  if (includeDefault) {
    return [...DEFAULT_DISALLOWED_OUTPUT, ...custom];
  }
  return custom.length ? custom : DEFAULT_DISALLOWED_OUTPUT;
}

/**
 * Z3: Parse JSON from text, stripping markdown fences.
 */
export function parseStructuredOutput<T>(text: string): T | null {
  let jsonStr = text.trim();
  const match = jsonStr.match(FENCE_REGEX);
  if (match?.[1]) jsonStr = match[1].trim();
  else if (jsonStr.startsWith('```')) {
    const first = jsonStr.indexOf('\n');
    if (first !== -1) {
      jsonStr = jsonStr.slice(first + 1).trim();
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3).trim();
    }
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

/**
 * Z3: Fix trailing commas in JSON string.
 */
function fixTrailingCommas(jsonStr: string): string {
  return jsonStr.replace(TRAILING_COMMA_REGEX, '$1');
}

/**
 * Z3: Extract JSON object between first { and last }.
 */
function extractJsonObject(text: string): string | null {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

/**
 * Z2: Repair malformed JSON from LLM output.
 */
export function repairMalformedJson<T>(raw: string): T | null {
  let jsonStr = raw.trim();
  const match = jsonStr.match(FENCE_REGEX);
  if (match?.[1]) jsonStr = match[1].trim();

  const attempts = [
    () => JSON.parse(jsonStr) as T,
    () => JSON.parse(fixTrailingCommas(jsonStr)) as T,
    () => {
      const extracted = extractJsonObject(jsonStr);
      return extracted ? (JSON.parse(extracted) as T) : null;
    },
  ];

  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Z3: Check output for leakage patterns (secrets, PII).
 */
export function checkLeakagePatterns(
  text: string,
  patterns: RegExp[] = DEFAULT_DISALLOWED_OUTPUT,
): string | null {
  for (const rx of patterns) {
    if (rx.test(text)) return 'output_leakage_detected';
  }
  return null;
}

/**
 * Z2: Validate prompt output against schema and policy.
 */
export function validatePromptOutput<T>(
  raw: string,
  schema: OutputSchema<T>,
  options?: ValidatePromptOutputOptions<T>,
): { ok: true; data: T } | { ok: false; reason: ValidatePromptOutputFailureReason } {
  const patterns = resolveLeakagePatterns(options);
  const leakage = checkLeakagePatterns(raw, patterns);
  if (leakage) {
    return { ok: false, reason: 'output_leakage_detected' };
  }

  let parsed: T | null = parseStructuredOutput<T>(raw);
  if (parsed === null) parsed = repairMalformedJson<T>(raw);

  if (parsed === null) {
    return { ok: false, reason: 'schema_invalid' };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: 'schema_invalid' };
  }

  if (options?.afterParse) {
    const domain = options.afterParse(result.data);
    if (!domain.ok) {
      return { ok: false, reason: 'output_domain_validation_failed' };
    }
  }

  return { ok: true, data: result.data };
}

/**
 * Z2: Repair JSON output with optional schema validation.
 */
export function repairJsonOutput<T>(
  raw: string,
  schema: OutputSchema<T>,
): T | null {
  let parsed: T | null = parseStructuredOutput<T>(raw);
  if (parsed === null) parsed = repairMalformedJson<T>(raw);
  if (parsed === null) return null;

  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}
