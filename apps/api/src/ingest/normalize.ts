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

function prevDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Derive the shift's business date from an event's wall-clock timestamp. A shift
 * runs D 23:00 -> D+1 07:00, so an event before 07:00 belongs to the prior date.
 * Uses the local time encoded in the ISO string (offset-aware), not UTC.
 */
export function nightOfFromTimestamp(ts: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}/.test(ts)) return null;
  const date = ts.slice(0, 10);
  const hour = Number(ts.slice(11, 13));
  return hour < 7 ? prevDay(date) : date;
}

export interface StructuredShiftGroup {
  nightOf: string; // YYYY-MM-DD, derived from the events
  startsAt: string; // earliest event timestamp in the group
  endsAt: string; // latest event timestamp in the group
  rawContent: string; // this shift's raw events, re-serialized (stored verbatim)
  events: NormalizedEvent[];
}

function toNormalized(event: RawStructuredEvent, index: number): NormalizedEvent {
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
 * Split a structured JSON source into shift groups by derived date. The caller
 * does not supply a date — the data does (BRIEF / user feedback). A source may
 * span several nights; each becomes its own shift. Throws on invalid JSON; the
 * raw text is still stored verbatim by the ingest service before this runs.
 */
export function splitStructuredByShift(content: string): StructuredShiftGroup[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`structured source is not valid JSON: ${(e as Error).message}`);
  }

  const raw = extractEventArray(parsed).map((r) => (r ?? {}) as RawStructuredEvent);

  const groups = new Map<string, RawStructuredEvent[]>();
  const undated: RawStructuredEvent[] = [];
  for (const event of raw) {
    const ts = str(event.timestamp);
    const night = ts ? nightOfFromTimestamp(ts) : null;
    if (!night) {
      undated.push(event);
      continue;
    }
    if (!groups.has(night)) groups.set(night, []);
    groups.get(night)!.push(event);
  }
  // Events without a usable timestamp attach to the earliest known shift so they
  // are never silently dropped; their normalized form carries an 'incomplete' flag.
  if (undated.length > 0) {
    const earliest = [...groups.keys()].sort()[0];
    if (earliest) groups.get(earliest)!.push(...undated);
    else groups.set('undated', undated);
  }

  const result: StructuredShiftGroup[] = [];
  for (const [nightOf, evs] of groups) {
    const times = evs
      .map((e) => str(e.timestamp))
      .filter((t): t is string => t !== null)
      .sort();
    result.push({
      nightOf,
      startsAt: times[0] ?? `${nightOf}T23:00:00Z`,
      endsAt: times[times.length - 1] ?? `${nightOf}T07:00:00Z`,
      rawContent: JSON.stringify({ events: evs }, null, 2),
      events: evs.map((e, i) => toNormalized(e, i)),
    });
  }
  result.sort((a, b) => a.nightOf.localeCompare(b.nightOf));
  return result;
}

/**
 * Normalize a free-text source. Each meaningful line becomes one item with a
 * `freetext:<nightOf>:L<n>` ref — unique per hotel (line numbers alone would
 * collide across nights). We do not parse rooms/times out of prose here; that is
 * the model's job, grounded in the line. Original language is preserved (UTF-8).
 */
export function normalizeFreeText(
  content: string,
  nightOf: string,
): NormalizedEvent[] {
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
      sourceRef: `freetext:${nightOf}:L${index + 1}`,
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
