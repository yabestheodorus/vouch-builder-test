// Seed the running API with the sample week, split into night shifts so
// reconciliation builds up across nights. Generates a handover after each shift.
//
// Usage (API must be running):
//   node apps/api/scripts/seed.mjs            # default hotel lumen-sg, API :3001
//   API_BASE=http://localhost:3001 HOTEL_ID=lumen-sg node apps/api/scripts/seed.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.API_BASE ?? 'http://localhost:3001';
const HOTEL = process.env.HOTEL_ID ?? 'lumen-sg';
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');

const events = JSON.parse(readFileSync(join(dataDir, 'events.json'), 'utf8')).events;
const nightLogs = readFileSync(join(dataDir, 'night-logs.md'), 'utf8');

// A shift runs D 23:00 -> D+1 07:00, so events before 07:00 belong to date D-1.
function prevDay(d) {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}
function nightOfFor(ts) {
  const date = ts.slice(0, 10);
  const hour = Number(ts.slice(11, 13));
  return hour < 7 ? prevDay(date) : date;
}

const byNight = new Map();
for (const e of events) {
  const n = nightOfFor(e.timestamp);
  if (!byNight.has(n)) byNight.set(n, []);
  byNight.get(n).push(e);
}

const shifts = [];
for (const [nightOf, evs] of byNight) {
  shifts.push({ nightOf, format: 'STRUCTURED', content: JSON.stringify({ events: evs }) });
}
// The one night logged as free text (system was down): Wed 27 -> Thu 28.
shifts.push({ nightOf: '2026-05-27', format: 'FREE_TEXT', content: nightLogs });
shifts.sort((a, b) => a.nightOf.localeCompare(b.nightOf));

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

for (const s of shifts) {
  const ing = await post('/ingest', {
    hotelId: HOTEL,
    nightOf: s.nightOf,
    startsAt: `${s.nightOf}T23:00:00+08:00`,
    endsAt: `${s.nightOf}T07:00:00+08:00`,
    sources: [{ format: s.format, content: s.content }],
  });
  const h = await post(`/hotels/${HOTEL}/handover`, { shiftId: ing.shiftId });
  const tag = (t) => h.items.filter((i) => i.reconcileTag === t).length;
  console.log(
    `night ${s.nightOf} [${s.format.padEnd(10)}] events=${String(ing.events).padStart(2)} -> ` +
      `items=${h.items.length} (new=${tag('NEW')} still=${tag('STILL_OPEN')} resolved=${tag('NEWLY_RESOLVED')})`,
  );
}
console.log('\nSeed complete. Open the web app or GET /hotels/' + HOTEL + '/handovers');
