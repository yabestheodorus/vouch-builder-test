import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { IngestShift, NormalizedEvent } from '@vouch/schema';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../common/json.util';
import { normalizeFreeText, normalizeStructured } from './normalize';

export interface IngestResult {
  hotelId: string;
  shiftId: string;
  nightOf: string;
  sources: number;
  events: number;
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingest one shift: stores each source verbatim (RawLog) and the mechanical
   * normalization (NormalizedEvent). Idempotent per (hotelId, nightOf) shift.
   * Everything is scoped to hotelId (AGENTS.md §3.3).
   */
  async ingestShift(hotelId: string, input: IngestShift): Promise<IngestResult> {
    // Scaffold: ensure the hotel exists. A real registry would carry name/rooms/tz.
    await this.prisma.hotel.upsert({
      where: { id: hotelId },
      update: {},
      create: { id: hotelId, name: hotelId, rooms: 0, timezone: '+00:00' },
    });

    const nightOf = new Date(input.nightOf);
    const shift = await this.prisma.shift.upsert({
      where: { hotelId_nightOf: { hotelId, nightOf } },
      update: {
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      },
      create: {
        hotelId,
        nightOf,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      },
    });

    let eventCount = 0;
    for (const source of input.sources) {
      const rawLog = await this.prisma.rawLog.create({
        data: {
          hotelId,
          shiftId: shift.id,
          format: source.format,
          content: source.content, // verbatim, UTF-8
        },
      });

      let normalized: NormalizedEvent[];
      try {
        normalized =
          source.format === 'STRUCTURED'
            ? normalizeStructured(source.content)
            : normalizeFreeText(source.content);
      } catch (e) {
        throw new BadRequestException(
          `Failed to normalize ${source.format} source: ${(e as Error).message}`,
        );
      }

      for (const event of normalized) {
        await this.prisma.normalizedEvent.create({
          data: {
            hotelId,
            shiftId: shift.id,
            rawLogId: rawLog.id,
            sourceRef: event.sourceRef,
            occurredAt: event.occurredAt ? new Date(event.occurredAt) : null,
            room: event.room,
            category: event.category,
            text: event.text,
            rawStatus: event.rawStatus,
            flags: toJson(event.flags),
          },
        });
        eventCount += 1;
      }
    }

    this.logger.log(
      `Ingested hotel=${hotelId} shift=${shift.id} sources=${input.sources.length} events=${eventCount}`,
    );

    return {
      hotelId,
      shiftId: shift.id,
      nightOf: input.nightOf,
      sources: input.sources.length,
      events: eventCount,
    };
  }
}
