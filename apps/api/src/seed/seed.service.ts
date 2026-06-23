import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { IngestService } from '../ingest/ingest.service';
import { HandoverService } from '../handover/handover.service';
import { HistoryService } from '../history/history.service';

/**
 * Demo convenience: wipe a hotel and reload the bundled sample week, generating
 * a handover per shift in date order so reconciliation builds up. Lets an
 * operator reset and re-run the whole flow from the UI in one click.
 *
 * The sample-specific bits (file names, the free-text night) live here, never in
 * the prompt — this is a fixture loader, not part of the generalizable pipeline.
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly ingest: IngestService,
    private readonly handover: HandoverService,
    private readonly history: HistoryService,
  ) {}

  private dataDir(): string {
    // Default assumes the API runs from apps/api; data/ sits at the repo root.
    return process.env.SAMPLE_DATA_DIR ?? resolve(process.cwd(), '..', '..', 'data');
  }

  async reseed(hotelId: string) {
    const dir = this.dataDir();
    let eventsJson: string;
    let nightLogs: string;
    try {
      eventsJson = await readFile(join(dir, 'events.json'), 'utf8');
      nightLogs = await readFile(join(dir, 'night-logs.md'), 'utf8');
    } catch (e) {
      throw new InternalServerErrorException(
        `Sample data not found in ${dir}. Set SAMPLE_DATA_DIR. (${(e as Error).message})`,
      );
    }

    await this.history.clearHotelData(hotelId);

    // Structured: one call, the API derives & splits shifts by timestamp.
    const structured = await this.ingest.ingest(hotelId, {
      hotelId,
      sources: [{ format: 'STRUCTURED', content: eventsJson }],
    });
    // Free text: the one night the system was down (Wed 27 -> Thu 28).
    const free = await this.ingest.ingest(hotelId, {
      hotelId,
      nightOf: '2026-05-27',
      sources: [{ format: 'FREE_TEXT', content: nightLogs }],
    });

    const shifts = [...structured.shifts, ...free.shifts].sort((a, b) =>
      a.nightOf.localeCompare(b.nightOf),
    );

    const handovers: Array<{ nightOf: string; items: number }> = [];
    for (const shift of shifts) {
      const h = await this.handover.generate(hotelId, shift.shiftId);
      handovers.push({ nightOf: shift.nightOf, items: h.items.length });
    }

    this.logger.log(`Reseeded hotel=${hotelId} shifts=${shifts.length}`);
    return { hotelId, shifts: shifts.length, handovers };
  }
}
