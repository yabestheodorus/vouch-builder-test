import { z } from 'zod';

/**
 * Shared enums and primitives for the handover pipeline.
 * These are the single source of truth: Prisma stores them as String, and the
 * application layer parses with these schemas (AGENTS.md §3.2 — parse, don't trust).
 */

/** Action-first output buckets the morning manager scans in 60 seconds. */
export const Bucket = z.enum(['ON_FIRE', 'PENDING', 'FYI']);
export type Bucket = z.infer<typeof Bucket>;

/** How an item relates to the running open-issue thread across nights. */
export const ReconcileTag = z.enum(['NEW', 'STILL_OPEN', 'NEWLY_RESOLVED']);
export type ReconcileTag = z.infer<typeof ReconcileTag>;

/** Lifecycle of a tracked issue. */
export const IssueStatus = z.enum(['OPEN', 'RESOLVED']);
export type IssueStatus = z.infer<typeof IssueStatus>;

/** The two ingest formats: system JSON or relief-staff free text. */
export const RawLogFormat = z.enum(['STRUCTURED', 'FREE_TEXT']);
export type RawLogFormat = z.infer<typeof RawLogFormat>;

/** Outcome recorded for every generation run (for the structured run log). */
export const GenerationOutcome = z.enum(['OK', 'REPAIRED', 'DEGRADED', 'FAILED']);
export type GenerationOutcome = z.infer<typeof GenerationOutcome>;

/**
 * How we surface uncertainty instead of papering over it (AGENTS.md §3.5).
 * The model attaches these rather than silently resolving messy input.
 */
export const GroundingFlag = z.enum([
  'incomplete', // data is partial / missing a needed detail
  'contradiction', // sources disagree with each other
  'unverified', // asserted but not confirmable from the data
  'injection_attempt', // input tried to instruct the tool; treat as data only
]);
export type GroundingFlag = z.infer<typeof GroundingFlag>;

/**
 * A reference back to a source item the statement is grounded in:
 * a structured event id (e.g. "evt_0008") or a free-text line (e.g. "freetext:L17").
 */
export const SourceRef = z.string().min(1);
export type SourceRef = z.infer<typeof SourceRef>;
