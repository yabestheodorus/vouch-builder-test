// Seed the running API with the sample week. Structured JSON is ingested in one
// call and auto-split into night shifts by the API; the free-text night is added
// separately. Then a handover is generated per shift in date order so the
// open-issue thread builds across nights.
//
// Usage (API must be running):
//   node apps/api/scripts/seed.mjs
//   API_BASE=http://localhost:3001 HOTEL_ID=lumen-sg node apps/api/scripts/seed.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.API_BASE ?? 'http://localhost:3001';
const HOTEL = process.env.HOTEL_ID ?? 'lumen-sg';
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');

const eventsJson = readFileSync(join(dataDir, 'events.json'), 'utf8');
const nightLogs = readFileSync(join(dataDir, 'night-logs.md'), 'utf8');

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// Structured: one call, the API derives and splits the shifts by timestamp.
const structured = await post('/ingest', {
  hotelId: HOTEL,
  sources: [{ format: 'STRUCTURED', content: eventsJson }],
});

// Free text: the one night the system was down (Wed 27 -> Thu 28).
const freeText = await post('/ingest', {
  hotelId: HOTEL,
  nightOf: '2026-05-27',
  sources: [{ format: 'FREE_TEXT', content: nightLogs }],
});

const shifts = [...structured.shifts, ...freeText.shifts].sort((a, b) =>
  a.nightOf.localeCompare(b.nightOf),
);

for (const s of shifts) {
  const h = await post(`/hotels/${HOTEL}/handover`, { shiftId: s.shiftId });
  const tag = (t) => h.items.filter((i) => i.reconcileTag === t).length;
  console.log(
    `night ${s.nightOf} [${s.format.padEnd(10)}] events=${String(s.events).padStart(2)} -> ` +
      `items=${h.items.length} (new=${tag('NEW')} still=${tag('STILL_OPEN')} resolved=${tag('NEWLY_RESOLVED')})`,
  );
}
console.log('\nSeed complete. Open the web app or GET /hotels/' + HOTEL + '/handovers');
