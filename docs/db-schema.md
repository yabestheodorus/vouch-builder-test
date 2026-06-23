# Database Schema

SQLite (file-based) via Prisma. The model exists to serve the five non-negotiables
in [`AGENTS.md`](../AGENTS.md): **per-hotel isolation**, **reconciliation across
nights**, **grounding**, and **structured logging**.

## 1. Design principles

- **`hotelId` on every operational row.** Isolation is enforced at the data layer:
  no operational table is queried without a `hotelId` filter (AGENTS §3.3).
- **Grounding is stored, not derived.** Source references are persisted so any
  output statement can be traced to an event id or a free-text line (AGENTS §3.5).
- **State carries the thread.** `Issue` is durable per-hotel state that lets each
  night classify items as New / Still open / Newly resolved without re-deriving
  from scratch (AGENTS §3.4).
- **UTF-8 text everywhere.** SQLite stores text as UTF-8; we never down-convert.
- **Append-only history.** Raw logs, handovers, and generation logs are immutable
  records — we add rows, we don't mutate past ones. Only `Issue` has mutable state.

## 2. Entities

### Hotel
The tenant boundary. Static registry.
| field      | type    | notes                                   |
|------------|---------|-----------------------------------------|
| id         | string  | PK, e.g. `lumen-sg`                     |
| name       | string  |                                         |
| rooms      | int     |                                         |
| timezone   | string  | e.g. `+08:00`; shift dates resolved here |

### Shift
One night shift (~23:00–07:00), spanning two calendar dates. The unit of "which
night" for logging and reconciliation.
| field        | type     | notes                                       |
|--------------|----------|---------------------------------------------|
| id           | string   | PK (cuid)                                   |
| hotelId      | string   | FK → Hotel                                  |
| nightOf      | date     | business date the shift *started* (anchor)  |
| startsAt     | datetime | inclusive (UTC stored, tz from Hotel)       |
| endsAt       | datetime | exclusive                                   |
| createdAt    | datetime |                                             |

`@@unique([hotelId, nightOf])` — one shift per hotel per night.

### RawLog
The original ingested input for a shift, stored verbatim (Reliability — we keep the
unaltered source, any language).
| field      | type   | notes                                          |
|------------|--------|------------------------------------------------|
| id         | string | PK                                             |
| hotelId    | string | FK → Hotel                                     |
| shiftId    | string | FK → Shift                                     |
| format     | enum   | `STRUCTURED` \| `FREE_TEXT`                     |
| content    | text   | raw JSON string or raw prose, UTF-8, untouched |
| receivedAt | datetime |                                              |

### NormalizedEvent
Each source item normalized to a common shape, **keeping its origin**. This is the
grounding anchor.
| field        | type   | notes                                                   |
|--------------|--------|---------------------------------------------------------|
| id           | string | PK                                                      |
| hotelId      | string | FK → Hotel                                              |
| shiftId      | string | FK → Shift                                              |
| rawLogId     | string | FK → RawLog                                             |
| sourceRef    | string | event `id` (e.g. `evt_0008`) or `freetext:L17` line ref |
| occurredAt   | datetime | best-known time; null if free text gives none         |
| room         | string?| nullable — many events have no room                    |
| category     | string | normalized category (maintenance, compliance, …)       |
| text         | text   | normalized description, original language preserved    |
| rawStatus    | string?| status as stated in source, if any                     |
| flags        | json   | `["incomplete"|"contradiction"|"unverified"|"injection_attempt"]` |

`sourceRef` is required — an event with no traceable origin cannot exist.

### Issue  (the reconciliation state)
Durable, mutable, **per-hotel** open-issue thread carried across nights.
| field          | type     | notes                                                  |
|----------------|----------|--------------------------------------------------------|
| id             | string   | PK                                                     |
| hotelId        | string   | FK → Hotel — **all reconciliation queries filter here**|
| status         | enum     | `OPEN` \| `RESOLVED`                                    |
| category       | string   | normalized                                            |
| title          | string   | short stable label for the thread                     |
| room           | string?  |                                                        |
| firstSeenShiftId | string | FK → Shift — when it first appeared                    |
| lastSeenShiftId  | string | FK → Shift — most recent night it was referenced       |
| resolvedShiftId  | string?| FK → Shift — null until resolved                       |
| sourceRefs     | json     | array of every NormalizedEvent sourceRef in the thread |
| flags          | json     | carried flags (e.g. contradiction across nights)       |
| updatedAt      | datetime |                                                        |

Reconciliation per run: load `Issue where hotelId AND status = OPEN` → match this
shift's events → mark **Still open** (touch `lastSeenShift`), **Newly resolved**
(set `status=RESOLVED`, `resolvedShift`), or create **New tonight**. State for the
next night is the post-run set of `OPEN` issues.

### Handover  (generated output)
One per generate-handover run. Immutable.
| field        | type     | notes                                            |
|--------------|----------|--------------------------------------------------|
| id           | string   | PK                                               |
| hotelId      | string   | FK → Hotel                                        |
| shiftId      | string   | FK → Shift                                        |
| generatedAt  | datetime |                                                  |
| model        | string   | Groq model id                                     |
| promptVersion| string   | ties output to exact prompt                       |
| summary      | text?    | optional one-line top-line                        |

### HandoverItem
The individual bullets, bucketed action-first. **Every item cites its sources.**
| field        | type   | notes                                              |
|--------------|--------|----------------------------------------------------|
| id           | string | PK                                                 |
| handoverId   | string | FK → Handover                                      |
| hotelId      | string | FK → Hotel (denormalized for scoped queries)       |
| bucket       | enum   | `ON_FIRE` \| `PENDING` \| `FYI`                    |
| issueId      | string?| FK → Issue — link to the reconciliation thread     |
| reconcileTag | enum   | `NEW` \| `STILL_OPEN` \| `NEWLY_RESOLVED`           |
| text         | text   | the statement shown to the manager                 |
| sourceRefs   | json   | required, non-empty — grounding for this statement |
| flags        | json   | `contradiction` / `incomplete` / `unverified` / …  |

A row with an empty `sourceRefs` is invalid — enforced in the schema layer.

### GenerationLog  (structured run log)
Debuggability for production (AGENTS §4). One row per run, success or failure.
| field        | type     | notes                                              |
|--------------|----------|----------------------------------------------------|
| id           | string   | PK                                                 |
| hotelId      | string   | which hotel                                        |
| shiftId      | string?  | which night                                        |
| handoverId   | string?  | FK → Handover (null if the run failed before save) |
| startedAt    | datetime |                                                    |
| durationMs   | int      |                                                    |
| model        | string   |                                                    |
| promptVersion| string   |                                                    |
| inputCounts  | json     | `{ events, freeTextLines, openIssuesIn }`          |
| reasoning    | text     | **why** the model produced this output             |
| flags        | json     | grounding flags raised this run                    |
| tokenUsage   | json?    | prompt/completion tokens                            |
| outcome      | enum     | `OK` \| `REPAIRED` \| `DEGRADED` \| `FAILED`       |
| error        | text?    | message + repair trail if any                      |

## 3. Relationships

```
Hotel 1─┬─* Shift
        ├─* RawLog
        ├─* NormalizedEvent
        ├─* Issue              (open-issue state, per hotel)
        ├─* Handover ─* HandoverItem
        └─* GenerationLog

Shift 1─* RawLog, NormalizedEvent, Handover, GenerationLog
RawLog 1─* NormalizedEvent
Issue 1─* HandoverItem        (a thread surfaced across nights' handovers)
```

## 4. Indexes (isolation + read paths)

- `Shift @@unique([hotelId, nightOf])`
- `Issue @@index([hotelId, status])`            — the reconciliation load
- `NormalizedEvent @@index([hotelId, shiftId])`
- `Handover @@index([hotelId, generatedAt])`    — handover history view
- `RawLog @@index([hotelId, shiftId])`          — raw-log history view
- `GenerationLog @@index([hotelId, startedAt])` — generation-log history view

The three frontend history views (handovers / raw logs / generation logs) map
directly to the last three indexes, each filtered by `hotelId`.

## 5. Notes / open questions for DECISIONS.md

- Issue ↔ event matching is initially heuristic (room + category + recency) with the
  model assisting; persisting `sourceRefs` keeps it auditable regardless.
- SQLite is fine for the timebox and single-writer load; `hotelId` scoping keeps a
  later move to Postgres (row-per-tenant) mechanical.
