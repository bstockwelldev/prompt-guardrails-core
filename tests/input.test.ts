/**
 * Input validation and guardrail tests.
 * Covers: malformed input, prompt injection, URL exfiltration,
 * control characters, and schema validation.
 */
import { describe, it, expect } from 'vitest';
import {
  validatePromptInput,
  normalizeWhitespace,
  stripInvisibleChars,
  containsUrl,
  checkInjectionPatterns,
  scrubSensitiveText,
  PromptGuardrailsError,
} from '@bstockwelldev/prompt-guardrails-core';
import type { PromptPolicy } from '@bstockwelldev/prompt-guardrails-core';
import {
  INJECTION_VECTORS,
  URL_EXFILTRATION_VECTORS,
  CONTROL_CHAR_VECTORS,
  VALID_INPUT_VECTORS,
} from './fixtures/red-team.js';

const DEFAULT_POLICY: PromptPolicy = {
  id: 'test',
  version: '1.0',
  key: 'test',
  system: 'You are helpful.',
  constraints: {
    maxTokens: 4096,
    allowUrls: false,
    maxInputLength: 64 * 1024,
  },
};

const POLICY_ALLOW_URLS: PromptPolicy = {
  ...DEFAULT_POLICY,
  constraints: { ...DEFAULT_POLICY.constraints, allowUrls: true },
};

describe('normalizeWhitespace', () => {
  it('collapses multiple spaces', () => {
    expect(normalizeWhitespace('a   b   c')).toBe('a b c');
  });
  it('trims leading and trailing whitespace', () => {
    expect(normalizeWhitespace('  hello  ')).toBe('hello');
  });
  it('handles newlines and tabs', () => {
    expect(normalizeWhitespace('a\n\t\nb')).toBe('a b');
  });
});

describe('stripInvisibleChars', () => {
  it('removes zero-width spaces', () => {
    expect(stripInvisibleChars('a\u200Bb\u200Bc')).toBe('abc');
  });
  it('removes null bytes', () => {
    expect(stripInvisibleChars('a\x00b')).toBe('ab');
  });
  it('removes BOM', () => {
    expect(stripInvisibleChars('\uFEFFhello')).toBe('hello');
  });
});

describe('containsUrl', () => {
  it('detects https URLs', () => {
    expect(containsUrl('Visit https://example.com')).toBe(true);
  });
  it('detects http URLs', () => {
    expect(containsUrl('Check http://evil.org')).toBe(true);
  });
  it('detects www URLs', () => {
    expect(containsUrl('Go to www.example.com')).toBe(true);
  });
  it('returns false for plain text', () => {
    expect(containsUrl('Hello world')).toBe(false);
  });
});

describe('checkInjectionPatterns', () => {
  it.each(INJECTION_VECTORS)('detects injection: %s', (input) => {
    const reason = checkInjectionPatterns(input);
    expect(reason).toBe('injection_detected');
  });
  it('returns null for an ordinary task', () => {
    expect(checkInjectionPatterns('Hello, help me design a game.')).toBe(null);
  });
});

describe('scrubSensitiveText', () => {
  it('redacts API keys', () => {
    const out = scrubSensitiveText('api_key: sk-12345');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('sk-12345');
  });
  it('redacts Bearer tokens', () => {
    const out = scrubSensitiveText('Authorization: Bearer eyJhbGc');
    expect(out).toContain('[REDACTED]');
  });
  it('redacts SSN-like patterns', () => {
    const out = scrubSensitiveText('SSN: 123-45-6789');
    expect(out).toContain('[REDACTED]');
  });
  it('redacts email addresses', () => {
    const out = scrubSensitiveText('Contact user@example.com');
    expect(out).toContain('[REDACTED]');
  });
  it('truncates very long output', () => {
    const long = 'x'.repeat(10000);
    expect(scrubSensitiveText(long).length).toBeLessThanOrEqual(8000);
  });
});

describe('validatePromptInput', () => {
  it('accepts valid input', () => {
    for (const input of VALID_INPUT_VECTORS) {
      expect(validatePromptInput(input, DEFAULT_POLICY)).toBe(
        normalizeWhitespace(stripInvisibleChars(input)),
      );
    }
  });

  it.each(INJECTION_VECTORS)('refuses a matching input with the policy reason: %s', (input) => {
    expect(() => validatePromptInput(input, DEFAULT_POLICY)).toThrow(
      expect.objectContaining({ reason: 'injection_detected' }),
    );
  });

  it('rejects URLs when allowUrls is false', () => {
    for (const input of URL_EXFILTRATION_VECTORS) {
      expect(() => validatePromptInput(input, DEFAULT_POLICY)).toThrow(
        PromptGuardrailsError,
      );
      expect(() => validatePromptInput(input, DEFAULT_POLICY)).toThrow(
        /url_blocked|URLs not allowed/,
      );
    }
  });

  it('allows URLs when allowUrls is true', () => {
    for (const input of URL_EXFILTRATION_VECTORS) {
      expect(() => validatePromptInput(input, POLICY_ALLOW_URLS)).not.toThrow();
    }
  });

  it('rejects control characters', () => {
    for (const input of CONTROL_CHAR_VECTORS) {
      expect(() => validatePromptInput(input, DEFAULT_POLICY)).toThrow(
        PromptGuardrailsError,
      );
      expect(() => validatePromptInput(input, DEFAULT_POLICY)).toThrow(
        /control_characters_blocked|control/,
      );
    }
  });

  it('rejects input exceeding maxInputLength', () => {
    const policy: PromptPolicy = {
      ...DEFAULT_POLICY,
      constraints: { ...DEFAULT_POLICY.constraints, maxInputLength: 10 },
    };
    try {
      validatePromptInput('12345678901', policy);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PromptGuardrailsError);
      expect((e as PromptGuardrailsError).reason).toBe('input_too_long');
    }
  });

  it('normalizes whitespace in accepted input', () => {
    const result = validatePromptInput('  hello   world  ', DEFAULT_POLICY);
    expect(result).toBe('hello world');
  });
});
