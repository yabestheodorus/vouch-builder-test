import { z } from 'zod';
import { GroundingFlag, SourceRef } from './common';

/**
 * A single source item normalized to a common shape, keeping its origin.
 * Produced by ingest from both structured events and free-text lines.
 * `sourceRef` is required — an event with no traceable origin cannot exist.
 *
 * Timestamps are ISO 8601 strings (timezone-aware); `null` when the source
 * gives no time (common in free text). Text preserves the original language.
 */
export const NormalizedEventSchema = z.object({
  sourceRef: SourceRef,
  occurredAt: z.string().nullable(), // ISO 8601 (with offset), or null if unknown
  room: z.string().nullable(),
  category: z.string().min(1),
  text: z.string().min(1), // original language preserved, never down-converted
  rawStatus: z.string().nullable(), // status as stated in the source, if any
  flags: z.array(GroundingFlag).default([]),
});
export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;
