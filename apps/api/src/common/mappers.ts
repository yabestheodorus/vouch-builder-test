import type { Issue, NormalizedEvent, GroundingFlag, IssueStatus } from '@vouch/schema';
import { parseStringArray } from './json.util';

/**
 * Map persisted rows (JSON-as-String columns, DateTime) back to the shared Zod
 * domain types used by the prompt and API. Structural input types keep these
 * decoupled from Prisma's generated type names.
 */

interface EventRow {
  sourceRef: string;
  occurredAt: Date | null;
  room: string | null;
  category: string;
  text: string;
  rawStatus: string | null;
  flags: string;
}

interface IssueRow {
  id: string;
  hotelId: string;
  status: string;
  category: string;
  title: string;
  room: string | null;
  firstSeenShiftId: string;
  lastSeenShiftId: string;
  resolvedShiftId: string | null;
  sourceRefs: string;
  flags: string;
}

export function mapEventRow(row: EventRow): NormalizedEvent {
  return {
    sourceRef: row.sourceRef,
    occurredAt: row.occurredAt ? row.occurredAt.toISOString() : null,
    room: row.room,
    category: row.category,
    text: row.text,
    rawStatus: row.rawStatus,
    flags: parseStringArray(row.flags) as GroundingFlag[],
  };
}

export function mapIssueRow(row: IssueRow): Issue {
  return {
    id: row.id,
    hotelId: row.hotelId,
    status: row.status as IssueStatus,
    category: row.category,
    title: row.title,
    room: row.room,
    firstSeenShiftId: row.firstSeenShiftId,
    lastSeenShiftId: row.lastSeenShiftId,
    resolvedShiftId: row.resolvedShiftId,
    sourceRefs: parseStringArray(row.sourceRefs),
    flags: parseStringArray(row.flags) as GroundingFlag[],
  };
}
