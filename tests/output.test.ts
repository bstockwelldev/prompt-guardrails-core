/**
 * Output validation and JSON repair tests.
 * Covers: malformed JSON, schema validation, repair regression, leakage detection.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validatePromptOutput,
  repairJsonOutput,
  parseStructuredOutput,
  repairMalformedJson,
  checkLeakagePatterns,
} from '@bstockwelldev/prompt-guardrails-core';
import {
  MALFORMED_JSON_VECTORS,
  LEAKAGE_VECTORS,
} from './fixtures/red-team.js';

const SimpleSchema = z.object({ a: z.number(), b: z.string() });
type Simple = z.infer<typeof SimpleSchema>;

describe('parseStructuredOutput', () => {
  it('parses plain JSON', () => {
    expect(parseStructuredOutput<Simple>('{"a": 1, "b": "x"}')).toEqual({
      a: 1,
      b: 'x',
    });
  });
  it('strips markdown fences', () => {
    expect(
      parseStructuredOutput<Simple>('```json\n{"a": 1, "b": "x"}\n```'),
    ).toEqual({ a: 1, b: 'x' });
  });
  it('returns null for invalid JSON', () => {
    expect(parseStructuredOutput<Simple>('not json')).toBe(null);
  });
});

describe('repairMalformedJson', () => {
  it('repairs trailing commas', () => {
    const result = repairMalformedJson<Simple>('{"a": 1, "b": "x",}');
    expect(result).toEqual({ a: 1, b: 'x' });
  });
  it('extracts JSON from surrounding text', () => {
    const result = repairMalformedJson<Simple>(
      'Here is the result: {"a": 42, "b": "ok"} thanks',
    );
    expect(result).toEqual({ a: 42, b: 'ok' });
  });
  it('returns null when repair fails', () => {
    expect(repairMalformedJson<Simple>('{]')).toBe(null);
    expect(repairMalformedJson<Simple>('not json')).toBe(null);
  });
});

describe('checkLeakagePatterns', () => {
  it.each(LEAKAGE_VECTORS)('detects leakage: %s', (input) => {
    const reason = checkLeakagePatterns(input);
    expect(reason).toBe('output_leakage_detected');
  });
  it('returns null for safe output', () => {
    expect(checkLeakagePatterns('{"result": "success"}')).toBe(null);
  });
});

describe('validatePromptOutput', () => {
  it('returns ok for valid JSON matching schema', () => {
    const result = validatePromptOutput(
      '{"a": 1, "b": "hello"}',
      SimpleSchema as any,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ a: 1, b: 'hello' });
  });

  it('returns schema_invalid for malformed JSON', () => {
    const result = validatePromptOutput('{invalid}', SimpleSchema as any);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('schema_invalid');
  });

  it('returns schema_invalid for JSON not matching schema', () => {
    const result = validatePromptOutput(
      '{"a": "not a number", "b": "x"}',
      SimpleSchema as any,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('schema_invalid');
  });

  it('returns output_leakage_detected for leakage', () => {
    const result = validatePromptOutput(
      '{"a": 1, "b": "here is your private key"}',
      SimpleSchema as any,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('output_leakage_detected');
  });

  it('returns output_domain_validation_failed when afterParse rejects', () => {
    const result = validatePromptOutput(
      '{"a": 1, "b": "ok"}',
      SimpleSchema as any,
      {
        afterParse: () => ({ ok: false }),
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('output_domain_validation_failed');
  });

  it('applies custom leakagePatterns', () => {
    const result = validatePromptOutput(
      '{"a": 1, "b": "forbiddenword"}',
      SimpleSchema as any,
      {
        leakagePatterns: [/forbiddenword/i],
        includeDefaultLeakagePatterns: false,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('output_leakage_detected');
  });

  it('repairs trailing comma and validates', () => {
    const result = validatePromptOutput(
      '{"a": 1, "b": "x",}',
      SimpleSchema as any,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ a: 1, b: 'x' });
  });
});

describe('repairJsonOutput', () => {
  it('returns parsed data when valid', () => {
    const result = repairJsonOutput(
      '{"a": 1, "b": "x"}',
      SimpleSchema as any,
    );
    expect(result).toEqual({ a: 1, b: 'x' });
  });
  it('returns null when schema validation fails', () => {
    const result = repairJsonOutput(
      '{"a": "wrong", "b": "x"}',
      SimpleSchema as any,
    );
    expect(result).toBe(null);
  });
  it('repairs and validates fenced JSON', () => {
    const result = repairJsonOutput(
      '```json\n{"a": 1, "b": "ok"}\n```',
      SimpleSchema as any,
    );
    expect(result).toEqual({ a: 1, b: 'ok' });
  });
});

describe('malformed JSON regression', () => {
  it.each([
    ['{"a": 1, "b": 2,}', { a: 1, b: 2 }],
    ['{"nested": {"x": 1,},}', { nested: { x: 1 } }],
    ['prefix {"valid": true} suffix', { valid: true }],
  ] as const)('repairs %s', (input, expected) => {
    const repaired = repairMalformedJson<unknown>(input);
    expect(repaired).toEqual(expected);
  });
});
