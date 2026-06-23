import { Injectable, Logger } from '@nestjs/common';
import type { GenerationOutcome } from '@vouch/schema';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../common/json.util';

export interface GenerationLogEntry {
  hotelId: string;
  shiftId: string | null;
  handoverId: string | null;
  durationMs: number;
  model: string;
  promptVersion: string;
  inputCounts: { events: number; openIssuesIn: number };
  reasoning: string;
  flags: string[];
  tokenUsage: unknown;
  outcome: GenerationOutcome;
  error?: string;
}

/**
 * Structured run log so another builder or an agent can debug a bad handover in
 * production: which hotel, which night, why (AGENTS.md §4). One row per run,
 * for success and failure alike.
 */
@Injectable()
export class GenerationLogService {
  private readonly logger = new Logger(GenerationLogService.name);

  async record(prisma: PrismaService, entry: GenerationLogEntry): Promise<void> {
    await prisma.generationLog.create({
      data: {
        hotelId: entry.hotelId,
        shiftId: entry.shiftId,
        handoverId: entry.handoverId,
        durationMs: entry.durationMs,
        model: entry.model,
        promptVersion: entry.promptVersion,
        inputCounts: toJson(entry.inputCounts),
        reasoning: entry.reasoning,
        flags: toJson(entry.flags),
        tokenUsage: entry.tokenUsage ? toJson(entry.tokenUsage) : null,
        outcome: entry.outcome,
        error: entry.error ?? null,
      },
    });
    // Mirror a one-line summary to the app log for live tailing.
    this.logger.log(
      `run hotel=${entry.hotelId} shift=${entry.shiftId ?? '-'} outcome=${entry.outcome} ` +
        `events=${entry.inputCounts.events} openIssues=${entry.inputCounts.openIssuesIn} ` +
        `ms=${entry.durationMs}`,
    );
  }
}
