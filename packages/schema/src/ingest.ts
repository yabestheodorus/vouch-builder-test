import { z } from 'zod';
import { RawLogFormat } from './common';

/**
 * What the ingest endpoint accepts for one shift. Input arrives as data, not a
 * hand-edited file (BRIEF). A single shift may carry multiple sources (e.g. the
 * system JSON plus a relief-staff free-text note). Content is stored verbatim.
 */
export const IngestSourceSchema = z.object({
  format: RawLogFormat,
  content: z.string(), // raw JSON string or prose, UTF-8, untouched (any language)
});
export type IngestSource = z.infer<typeof IngestSourceSchema>;

export const IngestShiftSchema = z.object({
  hotelId: z.string().min(1),
  nightOf: z.string().min(1), // ISO date — business date the shift started (anchor)
  startsAt: z.string().min(1), // ISO datetime
  endsAt: z.string().min(1), // ISO datetime
  sources: z.array(IngestSourceSchema).min(1),
});
export type IngestShift = z.infer<typeof IngestShiftSchema>;
