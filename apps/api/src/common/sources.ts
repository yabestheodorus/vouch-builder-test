import type { PrismaService } from '../prisma/prisma.service';

/**
 * A source ref resolved to the underlying raw text, so the UI can make every
 * citation clickable (user feedback). Scoped to the hotel.
 */
export interface ResolvedSource {
  ref: string;
  text: string; // the raw line / event description this ref points at
  room: string | null;
  occurredAt: string | null;
  category: string;
  format: string; // STRUCTURED | FREE_TEXT
  nightOf: string | null;
}

/**
 * Resolve a set of sourceRefs to their stored normalized events. Refs are unique
 * per hotel (structured event ids; free-text refs include the night), so this is
 * an unambiguous lookup. Returns a map keyed by ref for easy frontend joins.
 */
export async function resolveSources(
  prisma: PrismaService,
  hotelId: string,
  refs: string[],
): Promise<Record<string, ResolvedSource>> {
  const unique = [...new Set(refs)];
  if (unique.length === 0) return {};

  const rows = await prisma.normalizedEvent.findMany({
    where: { hotelId, sourceRef: { in: unique } },
    include: {
      rawLog: { select: { format: true } },
      shift: { select: { nightOf: true } },
    },
  });

  const map: Record<string, ResolvedSource> = {};
  for (const r of rows) {
    map[r.sourceRef] = {
      ref: r.sourceRef,
      text: r.text,
      room: r.room,
      occurredAt: r.occurredAt ? r.occurredAt.toISOString() : null,
      category: r.category,
      format: r.rawLog.format,
      nightOf: r.shift.nightOf.toISOString(),
    };
  }
  return map;
}
