import { z } from 'zod';
import { RawLogFormat } from './common';

/**
 * What the ingest endpoint accepts. Input arrives as data, not a hand-edited
 * file (BRIEF). A request may carry multiple sources (e.g. system JSON plus a
 * relief-staff free-text note). Content is stored verbatim.
 *
 * Date handling:
 *   - STRUCTURED sources carry per-event timestamps, so the shift date(s) are
 *     DERIVED from the data and may span several nights — no date is required.
 *   - FREE_TEXT prose has no machine-readable date, so `nightOf` is required
 *     when any source is FREE_TEXT.
 */
export const IngestSourceSchema = z.object({
  format: RawLogFormat,
  content: z.string(), // raw JSON string or prose, UTF-8, untouched (any language)
});
export type IngestSource = z.infer<typeof IngestSourceSchema>;

export const IngestRequestSchema = z.object({
  hotelId: z.string().min(1),
  // Business date the shift started (ISO date). Required only for FREE_TEXT.
  nightOf: z.string().min(1).optional(),
  sources: z.array(IngestSourceSchema).min(1),
});
export type IngestRequest = z.infer<typeof IngestRequestSchema>;
