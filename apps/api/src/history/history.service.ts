import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseJsonObject, parseStringArray } from '../common/json.util';

/**
 * Read models for the three frontend menus, all scoped per hotel (AGENTS.md §5):
 * generated handovers, raw shift logs, and structured generation logs.
 */
@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listHandovers(hotelId: string) {
    const rows = await this.prisma.handover.findMany({
      where: { hotelId },
      orderBy: { generatedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return rows.map((h) => ({
      id: h.id,
      shiftId: h.shiftId,
      generatedAt: h.generatedAt,
      model: h.model,
      promptVersion: h.promptVersion,
      summary: h.summary,
      itemCount: h._count.items,
    }));
  }

  async getHandover(hotelId: string, id: string) {
    const handover = await this.prisma.handover.findFirst({
      where: { id, hotelId },
      include: { items: true },
    });
    if (!handover) throw new NotFoundException(`Handover ${id} not found`);
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

  async listRawLogs(hotelId: string) {
    const rows = await this.prisma.rawLog.findMany({
      where: { hotelId },
      orderBy: { receivedAt: 'desc' },
      include: { shift: true },
    });
    return rows.map((r) => ({
      id: r.id,
      shiftId: r.shiftId,
      nightOf: r.shift.nightOf,
      format: r.format,
      content: r.content,
      receivedAt: r.receivedAt,
    }));
  }

  async listGenerationLogs(hotelId: string) {
    const rows = await this.prisma.generationLog.findMany({
      where: { hotelId },
      orderBy: { startedAt: 'desc' },
    });
    return rows.map((g) => ({
      id: g.id,
      shiftId: g.shiftId,
      handoverId: g.handoverId,
      startedAt: g.startedAt,
      durationMs: g.durationMs,
      model: g.model,
      promptVersion: g.promptVersion,
      outcome: g.outcome,
      inputCounts: parseJsonObject(g.inputCounts),
      reasoning: g.reasoning,
      flags: parseStringArray(g.flags),
      tokenUsage: parseJsonObject(g.tokenUsage),
      error: g.error,
    }));
  }
}
