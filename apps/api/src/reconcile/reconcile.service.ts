import { Injectable, Logger } from '@nestjs/common';
import type { HandoverDraft, Issue } from '@vouch/schema';
import { PrismaService } from '../prisma/prisma.service';
import { mapIssueRow } from '../common/mappers';
import { parseStringArray, toJson, unique } from '../common/json.util';

/**
 * Owns the open-issue thread carried across nights, strictly per hotel
 * (AGENTS.md §3.3, §3.4). State is loaded for the prompt and updated after each
 * generation so the next night reconciles against it instead of from scratch.
 */
@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** OPEN issues for one hotel — the carry-over state fed into the prompt. */
  async loadOpenIssues(hotelId: string): Promise<Issue[]> {
    const rows = await this.prisma.issue.findMany({
      where: { hotelId, status: 'OPEN' },
      orderBy: { updatedAt: 'asc' },
    });
    return rows.map(mapIssueRow);
  }

  /** The set of open-issue ids the model was actually shown, for validation. */
  openIssueIds(issues: Issue[]): Set<string> {
    return new Set(issues.map((i) => i.id));
  }

  /**
   * Persist the model's reconciliation decisions for the next night.
   * - NEW (non-FYI): opens a fresh issue thread.
   * - STILL_OPEN: touches the matched thread (lastSeen + merged refs).
   * - NEWLY_RESOLVED: closes the matched thread.
   * Every issue lookup is filtered by hotelId, so a model-supplied id that
   * belongs to another hotel can never mutate it (isolation as a hard boundary).
   */
  async applyReconciliation(
    hotelId: string,
    shiftId: string,
    draft: HandoverDraft,
  ): Promise<void> {
    for (const item of draft.items) {
      if (item.reconcileTag === 'NEW') {
        if (item.bucket === 'FYI') continue; // FYI is informational, not a thread
        await this.prisma.issue.create({
          data: {
            hotelId,
            status: 'OPEN',
            category: 'general',
            title: item.text.slice(0, 120),
            room: null,
            firstSeenShiftId: shiftId,
            lastSeenShiftId: shiftId,
            resolvedShiftId: null,
            sourceRefs: toJson(item.sourceRefs),
            flags: toJson(item.flags),
          },
        });
        continue;
      }

      // STILL_OPEN / NEWLY_RESOLVED must reference an existing open issue.
      if (!item.issueId) {
        this.logger.warn(
          `Item tagged ${item.reconcileTag} without issueId — skipping state update.`,
        );
        continue;
      }
      const existing = await this.prisma.issue.findFirst({
        where: { id: item.issueId, hotelId },
      });
      if (!existing) {
        this.logger.warn(
          `Item references issue ${item.issueId} not open for hotel ${hotelId} — skipping.`,
        );
        continue;
      }

      const mergedRefs = unique([
        ...parseStringArray(existing.sourceRefs),
        ...item.sourceRefs,
      ]);

      if (item.reconcileTag === 'NEWLY_RESOLVED') {
        await this.prisma.issue.update({
          where: { id: existing.id },
          data: {
            status: 'RESOLVED',
            resolvedShiftId: shiftId,
            lastSeenShiftId: shiftId,
            sourceRefs: toJson(mergedRefs),
          },
        });
      } else {
        await this.prisma.issue.update({
          where: { id: existing.id },
          data: {
            lastSeenShiftId: shiftId,
            sourceRefs: toJson(mergedRefs),
            flags: toJson(
              unique([...parseStringArray(existing.flags), ...item.flags]),
            ),
          },
        });
      }
    }
  }
}
