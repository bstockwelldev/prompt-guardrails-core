import { describe, expect, it } from 'vitest';
import {
  filterInsightsBySource,
  quoteAppearsInSource,
} from '../src/evidence.js';

describe('quoteAppearsInSource', () => {
  it('returns true for exact substring', () => {
    expect(
      quoteAppearsInSource('draw two cards', 'You may draw two cards.', {
        normalizeWhitespace: false,
      }),
    ).toBe(true);
  });

  it('returns false when quote is not in source', () => {
    expect(
      quoteAppearsInSource('invented phrase', 'Only real text here', {
        normalizeWhitespace: false,
      }),
    ).toBe(false);
  });

  it('normalizes whitespace when enabled', () => {
    expect(
      quoteAppearsInSource('draw  two', 'draw two', { normalizeWhitespace: true }),
    ).toBe(true);
  });
});

describe('filterInsightsBySource', () => {
  it('keeps grounded items only', () => {
    const items = [
      { evidence: { text_span: 'alpha' } },
      { evidence: { text_span: 'ghost' } },
    ];
    const out = filterInsightsBySource(items, 'The alpha beta', {
      normalizeWhitespace: false,
    });
    expect(out).toEqual([{ evidence: { text_span: 'alpha' } }]);
  });
});
