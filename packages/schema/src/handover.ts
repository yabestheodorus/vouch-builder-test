import { z } from 'zod';
import { Bucket, GroundingFlag, ReconcileTag, SourceRef } from './common';

/**
 * One bullet in the handover. Every statement MUST cite at least one source —
 * this is the schema-level guarantee against invented facts (AGENTS.md §3.5).
 * If the model can't ground a claim, the schema rejects it.
 */
export const HandoverItemSchema = z.object({
  bucket: Bucket,
  reconcileTag: ReconcileTag,
  /**
   * For STILL_OPEN / NEWLY_RESOLVED, the id of the carried-over open issue this
   * item continues or resolves (taken from the provided openIssues). null for
   * NEW. Lets reconciliation update the right thread deterministically instead
   * of fuzzy-matching after the fact.
   */
  issueId: z.string().nullable().default(null),
  text: z.string().min(1),
  /**
   * One short sentence on why this item is where it is: why this bucket, why
   * this reconcile tag, and what in the sources supports it. Per-item grounding
   * the operator (and debugger) can read at a glance.
   */
  why: z.string().min(1),
  sourceRefs: z.array(SourceRef).min(1, 'every statement must cite a source'),
  flags: z.array(GroundingFlag).default([]),
});
export type HandoverItem = z.infer<typeof HandoverItemSchema>;

/**
 * The structured output the model is REQUIRED to return. We validate every LLM
 * response against this schema; malformed output is repaired then degraded,
 * never trusted raw (AGENTS.md §3.2). `reasoning` is persisted to the run log
 * so a bad handover is debuggable in production (AGENTS.md §4).
 */
export const HandoverDraftSchema = z.object({
  summary: z.string().min(1), // one-line top-line the manager reads first
  items: z.array(HandoverItemSchema),
  reasoning: z.string().min(1), // model's short why: how it classified/grounded
});
export type HandoverDraft = z.infer<typeof HandoverDraftSchema>;
