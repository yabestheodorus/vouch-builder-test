import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { IngestRequest } from '@vouch/schema';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../common/json.util';
import {
  normalizeFreeText,
  splitStructuredByShift,
  type StructuredShiftGroup,
} from './normalize';

export interface IngestedShift {
  shiftId: string;
  nightOf: string;
  format: 'STRUCTURED' | 'FREE_TEXT';
  events: number;
}

export interface IngestResult {
  hotelId: string;
  shifts: IngestedShift[];
}

function nextDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingest one or more sources. Structured sources derive their shift date(s)
   * from event timestamps and may span several nights; free text needs an
   * explicit nightOf. Everything is scoped to hotelId (AGENTS.md §3.3).
   */
  async ingest(hotelId: string, input: IngestRequest): Promise<IngestResult> {
    await this.prisma.hotel.upsert({
      where: { id: hotelId },
      update: {},
      create: { id: hotelId, name: hotelId, rooms: 0, timezone: '+00:00' },
    });

    const shifts: IngestedShift[] = [];

    for (const source of input.sources) {
      if (source.format === 'STRUCTURED') {
        let groups: StructuredShiftGroup[];
        try {
          groups = splitStructuredByShift(source.content);
        } catch (e) {
          throw new BadRequestException(
            `Failed to parse STRUCTURED source: ${(e as Error).message}`,
          );
        }
        for (const group of groups) {
          const shift = await this.upsertShift(
            hotelId,
            group.nightOf,
            new Date(group.startsAt),
            new Date(group.endsAt),
          );
          const rawLog = await this.prisma.rawLog.create({
            data: {
              hotelId,
              shiftId: shift.id,
              format: 'STRUCTURED',
              content: group.rawContent,
            },
          });
          await this.persistEvents(hotelId, shift.id, rawLog.id, group.events);
          shifts.push({
            shiftId: shift.id,
            nightOf: group.nightOf,
            format: 'STRUCTURED',
            events: group.events.length,
          });
        }
      } else {
        if (!input.nightOf) {
          throw new BadRequestException(
            'nightOf is required when a source is FREE_TEXT (prose carries no date).',
          );
        }
        const nightOf = input.nightOf.slice(0, 10);
        const shift = await this.upsertShift(
          hotelId,
          nightOf,
          new Date(`${nightOf}T23:00:00Z`),
          new Date(`${nextDay(nightOf)}T07:00:00Z`),
        );
        const rawLog = await this.prisma.rawLog.create({
          data: {
            hotelId,
            shiftId: shift.id,
            format: 'FREE_TEXT',
            content: source.content, // verbatim, UTF-8
          },
        });
        const events = normalizeFreeText(source.content, nightOf);
        await this.persistEvents(hotelId, shift.id, rawLog.id, events);
        shifts.push({
          shiftId: shift.id,
          nightOf,
          format: 'FREE_TEXT',
          events: events.length,
        });
      }
    }

    this.logger.log(
      `Ingested hotel=${hotelId} shifts=${shifts.length} ` +
        `events=${shifts.reduce((n, s) => n + s.events, 0)}`,
    );
    return { hotelId, shifts };
  }

  private async upsertShift(
    hotelId: string,
    nightOf: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const nightOfDate = new Date(`${nightOf}T00:00:00Z`);
    return this.prisma.shift.upsert({
      where: { hotelId_nightOf: { hotelId, nightOf: nightOfDate } },
      update: { startsAt, endsAt },
      create: { hotelId, nightOf: nightOfDate, startsAt, endsAt },
    });
  }

  private async persistEvents(
    hotelId: string,
    shiftId: string,
    rawLogId: string,
    events: { sourceRef: string; occurredAt: string | null; room: string | null; category: string; text: string; rawStatus: string | null; flags: string[] }[],
  ) {
    for (const event of events) {
      await this.prisma.normalizedEvent.create({
        data: {
          hotelId,
          shiftId,
          rawLogId,
          sourceRef: event.sourceRef,
          occurredAt: event.occurredAt ? new Date(event.occurredAt) : null,
          room: event.room,
          category: event.category,
          text: event.text,
          rawStatus: event.rawStatus,
          flags: toJson(event.flags),
        },
      });
    }
  }
}
