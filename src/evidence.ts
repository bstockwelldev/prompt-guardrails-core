/**
 * Host-shared helpers for grounding model output spans against a canonical source string.
 */

export type QuoteInSourceOptions = {
  /** Collapse internal whitespace when matching (does not trim quote boundaries). */
  normalizeWhitespace?: boolean;
};

function normalizeForMatch(value: string, normalizeWhitespace: boolean): string {
  if (!normalizeWhitespace) return value;
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Returns true if `quote` appears as a substring of `source` (optionally after whitespace normalization).
 */
export function quoteAppearsInSource(
  quote: string,
  source: string,
  opts?: QuoteInSourceOptions,
): boolean {
  const nw = opts?.normalizeWhitespace ?? true;
  const q = normalizeForMatch(quote, nw);
  const src = normalizeForMatch(source, nw);
  if (!q.length) return false;
  return src.includes(q);
}

/**
 * Keeps items whose `evidence.text_span` is grounded in `source`.
 */
export function filterInsightsBySource<
  T extends { evidence?: { text_span?: string } },
>(items: T[], source: string, opts?: QuoteInSourceOptions): T[] {
  return items.filter((item) => {
    const span = item.evidence?.text_span;
    if (typeof span !== 'string' || !span.length) return false;
    return quoteAppearsInSource(span, source, opts);
  });
}
