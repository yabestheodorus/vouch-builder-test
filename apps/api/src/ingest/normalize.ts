import type { GroundingFlag, NormalizedEvent } from '@vouch/schema';

/**
 * Normalization is deliberately MECHANICAL and traceable. It never interprets
 * or invents — it only reshapes each source item and attaches a sourceRef back
 * to its origin. All semantic work (classification, reconciliation) happens
 * later in the model step, which can only cite these refs (AGENTS.md §3.5).
 */

interface RawStructuredEvent {
  id?: unknown;
  timestamp?: unknown;
  type?: unknown;
  room?: unknown;
  description?: unknown;
  status?: unknown;
}

function str(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/**
 * Normalize a structured JSON source. Accepts `{ events: [...] }` or a bare
 * array. Throws on invalid JSON so the caller can return a 4xx — the raw text
 * is still stored verbatim by the ingest service before this runs.
 */
export function normalizeStructured(content: string): NormalizedEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`structured source is not valid JSON: ${(e as Error).message}`);
  }

  const events = extractEventArray(parsed);
  return events.map((raw, index) => {
    const event = (raw ?? {}) as RawStructuredEvent;
    const flags: GroundingFlag[] = [];
    let sourceRef = str(event.id);
    if (!sourceRef) {
      sourceRef = `evt_idx_${index}`;
      flags.push('incomplete'); // no stable id in the source
    }
    return {
      sourceRef,
      occurredAt: str(event.timestamp),
      room: str(event.room),
      category: str(event.type) ?? 'event',
      text: str(event.description) ?? '',
      rawStatus: str(event.status),
      flags,
    };
  });
}

function extractEventArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && 'events' in parsed) {
    const events = (parsed as { events: unknown }).events;
    if (Array.isArray(events)) return events;
  }
  throw new Error('structured source has no events array');
}

/**
 * Normalize a free-text source. Each meaningful line becomes one item with a
 * `freetext:L<n>` ref (1-based, matching the stored raw content). We do not try
 * to parse rooms/times out of prose here — that is the model's job, grounded in
 * the line. Markdown headers and horizontal rules are skipped as non-content.
 * Original language is preserved untouched (UTF-8).
 */
export function normalizeFreeText(content: string): NormalizedEvent[] {
  const lines = content.split(/\r?\n/);
  const out: NormalizedEvent[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    if (/^#{1,6}\s/.test(trimmed)) return; // markdown header
    if (/^[-*_]{3,}$/.test(trimmed)) return; // horizontal rule
    if (/^>\s*$/.test(trimmed)) return; // empty blockquote marker

    const text = trimmed.replace(/^[-*]\s+/, '').replace(/^>\s+/, '');
    if (text.length === 0) return;

    out.push({
      sourceRef: `freetext:L${index + 1}`,
      occurredAt: null,
      room: null,
      category: 'note',
      text,
      rawStatus: null,
      flags: [],
    });
  });

  return out;
}
