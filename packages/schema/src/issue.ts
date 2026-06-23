import { z } from 'zod';
import { GroundingFlag, IssueStatus, SourceRef } from './common';

/**
 * The durable, per-hotel open-issue thread carried across nights.
 * Reconciliation reads OPEN issues for a hotel, diffs them against the new
 * shift, and writes the updated set back (AGENTS.md §3.4). Always hotel-scoped.
 */
export const IssueSchema = z.object({
  id: z.string(),
  hotelId: z.string(),
  status: IssueStatus,
  category: z.string(),
  title: z.string(), // short, stable label for the thread
  room: z.string().nullable(),
  firstSeenShiftId: z.string(),
  lastSeenShiftId: z.string(),
  resolvedShiftId: z.string().nullable(),
  sourceRefs: z.array(SourceRef), // every event ref that fed this thread
  flags: z.array(GroundingFlag).default([]),
});
export type Issue = z.infer<typeof IssueSchema>;
