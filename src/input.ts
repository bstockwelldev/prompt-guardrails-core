import type { PromptPolicy } from './types.js';
import { PromptGuardrailsError } from './errors.js';

const INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(\bsystem|\bassistant|\bdeveloper|\btool)\s*:/i, reason: 'injection_detected' },
  { pattern: /ignore\s+all\s+previous\s+instructions/i, reason: 'injection_detected' },
  { pattern: /simulate\s+being\s+a\s+different\s+model/i, reason: 'injection_detected' },
];

const URL_PATTERN = /(https?:\/\/|www\.)/i;

/** Control chars and zero-width chars that can obfuscate injection */
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200D\uFEFF]/g;

/**
 * Z3: Normalize whitespace (collapse runs, trim).
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Z3: Strip invisible/control characters.
 */
export function stripInvisibleChars(text: string): string {
  return text.replace(CONTROL_CHARS, '');
}

/**
 * Z3: Check if text contains URLs.
 */
export function containsUrl(text: string): boolean {
  return URL_PATTERN.test(text);
}

/**
 * Z3: Check for prompt injection patterns.
 */
export function checkInjectionPatterns(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(lower)) return reason;
  }
  return null;
}

/**
 * Z3: Scrub sensitive text for telemetry (redact PII, secrets).
 */
export function scrubSensitiveText(text: string): string {
  let out = text;
  const secrets = [
    { rx: /api[_-]?key[:\s]+(\S+)/gi, rep: 'apiKey: [REDACTED]' },
    { rx: /authorization[:\s]+(Bearer\s+\S+)/gi, rep: 'authorization: [REDACTED]' },
    { rx: /token[:\s]+(\S+)/gi, rep: 'token: [REDACTED]' },
  ];
  const pii = [
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b\d{12,19}\b/g,
    /\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g,
  ];
  for (const { rx, rep } of secrets) out = out.replace(rx, rep);
  for (const rx of pii) out = out.replace(rx, '[REDACTED]');
  return out.slice(0, 8000);
}

/**
 * Z2: Validate prompt input against policy.
 * Throws PromptGuardrailsError on policy violation.
 */
export function validatePromptInput(input: string, policy: PromptPolicy): string {
  let normalized = input;
  normalized = stripInvisibleChars(normalized);
  normalized = normalizeWhitespace(normalized);

  const maxLen = policy.constraints.maxInputLength ?? 64 * 1024;
  if (normalized.length > maxLen) {
    throw new PromptGuardrailsError(
      'input_too_long',
      `Input exceeds max length (${maxLen})`,
      `length=${normalized.length}`,
    );
  }

  const controlCheck = input.replace(CONTROL_CHARS, '');
  if (controlCheck.length !== input.length) {
    throw new PromptGuardrailsError(
      'control_characters_blocked',
      'Input contains disallowed control characters',
    );
  }

  const injectionReason = checkInjectionPatterns(normalized);
  if (injectionReason) {
    throw new PromptGuardrailsError(
      'injection_detected',
      'Prompt injection pattern detected',
      injectionReason,
    );
  }

  if (!policy.constraints.allowUrls && containsUrl(normalized)) {
    throw new PromptGuardrailsError(
      'url_blocked',
      'URLs not allowed by policy',
    );
  }

  return normalized;
}
