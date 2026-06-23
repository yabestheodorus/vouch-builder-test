import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { HandoverDraft } from '@vouch/schema';
import type { HandoverPromptInput } from '@vouch/prompts';
import { PrismaService } from '../prisma/prisma.service';
import { ReconcileService } from '../reconcile/reconcile.service';
import { HandoverGeneratorService } from '../llm/handover-generator.service';
import { GenerationLogService } from '../logging/generation-log.service';
import { mapEventRow } from '../common/mappers';
import { parseStringArray, toJson, unique } from '../common/json.util';

/**
 * Orchestrates one generate-handover run end-to-end, scoped to a hotel:
 *   resolve shift -> load events + open issues -> generate (validate/repair/
 *   degrade) -> persist immutable handover -> update reconciliation state ->
 *   write the structured run log. Returns the rendered handover.
 */
@Injectable()
export class HandoverService {
  private readonly logger = new Logger(HandoverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reconcile: ReconcileService,
    private readonly generator: HandoverGeneratorService,
    private readonly genLog: GenerationLogService,
  ) {}

  async generate(hotelId: string, shiftId?: string) {
    const startedAt = Date.now();

    const shift = shiftId
      ? await this.prisma.shift.findFirst({ where: { id: shiftId, hotelId } })
      : await this.prisma.shift.findFirst({
          where: { hotelId },
          orderBy: { nightOf: 'desc' },
        });
    if (!shift) {
      throw new NotFoundException(
        `No shift found for hotel ${hotelId}${shiftId ? ` (shift ${shiftId})` : ''}`,
      );
    }

    const eventRows = await this.prisma.normalizedEvent.findMany({
      where: { hotelId, shiftId: shift.id },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
    const events = eventRows.map(mapEventRow);
    const openIssues = await this.reconcile.loadOpenIssues(hotelId);

    const promptInput: HandoverPromptInput = {
      hotelId,
      nightOf: shift.nightOf.toISOString(),
      events,
      openIssues,
    };

    const result = await this.generator.generate(promptInput);

    // Isolation guard: never persist an issueId the model wasn't actually shown
    // for this hotel. Foreign/hallucinated ids are dropped (and flagged).
    const validIds = this.reconcile.openIssueIds(openIssues);
    const draft = this.sanitizeIssueRefs(result.draft, validIds);

    const handover = await this.prisma.handover.create({
      data: {
        hotelId,
        shiftId: shift.id,
        model: result.model,
        promptVersion: result.promptVersion,
        summary: draft.summary,
        items: {
          create: draft.items.map((item) => ({
            hotelId,
            bucket: item.bucket,
            issueId: item.issueId,
            reconcileTag: item.reconcileTag,
            text: item.text,
            sourceRefs: toJson(item.sourceRefs),
            flags: toJson(item.flags),
          })),
        },
      },
      include: { items: true },
    });

    // Update carry-over state for the next night.
    await this.reconcile.applyReconciliation(hotelId, shift.id, draft);

    await this.genLog.record(this.prisma, {
      hotelId,
      shiftId: shift.id,
      handoverId: handover.id,
      durationMs: Date.now() - startedAt,
      model: result.model,
      promptVersion: result.promptVersion,
      inputCounts: { events: events.length, openIssuesIn: openIssues.length },
      reasoning: draft.reasoning,
      flags: unique(draft.items.flatMap((i) => i.flags)),
      tokenUsage: result.usage,
      outcome: result.outcome,
      error: result.error,
    });

    return this.render(handover);
  }

  /** Drop issueIds the model invented or borrowed from another hotel. */
  private sanitizeIssueRefs(
    draft: HandoverDraft,
    validIds: Set<string>,
  ): HandoverDraft {
    return {
      ...draft,
      items: draft.items.map((item) => {
        if (item.issueId && !validIds.has(item.issueId)) {
          return {
            ...item,
            issueId: null,
            flags: unique([...item.flags, 'unverified']),
          };
        }
        return item;
      }),
    };
  }

  private render(handover: {
    id: string;
    hotelId: string;
    shiftId: string;
    generatedAt: Date;
    model: string;
    promptVersion: string;
    summary: string | null;
    items: Array<{
      id: string;
      bucket: string;
      reconcileTag: string;
      issueId: string | null;
      text: string;
      sourceRefs: string;
      flags: string;
    }>;
  }) {
    return {
      id: handover.id,
      hotelId: handover.hotelId,
      shiftId: handover.shiftId,
      generatedAt: handover.generatedAt,
      model: handover.model,
      promptVersion: handover.promptVersion,
      summary: handover.summary,
      items: handover.items.map((item) => ({
        id: item.id,
        bucket: item.bucket,
        reconcileTag: item.reconcileTag,
        issueId: item.issueId,
        text: item.text,
        sourceRefs: parseStringArray(item.sourceRefs),
        flags: parseStringArray(item.flags),
      })),
    };
  }
}
