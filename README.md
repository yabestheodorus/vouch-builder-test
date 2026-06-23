# Vouch Builder Take-Home

Welcome — thanks for taking the time.

**Start here:** read [`BRIEF.md`](BRIEF.md). It describes the task, what to build,
and how to submit.

Your sample data is in [`data/`](data/):
- `events.json` — structured front-desk events
- `night-logs.md` — one night logged as free text

Timebox is ~2 hours. We're looking for sharp tradeoffs, not completeness. Good luck.

---

# vouch-frontdesk-hotel-log

Turns a hotel night team's raw shift logs (structured JSON and/or free-text prose,
any language) into an **action-first morning handover** — On fire / Pending / FYI —
reconciled across nights and grounded in the source.

Monorepo: `apps/api` (NestJS) · `apps/web` (Next.js) · `packages/schema` (shared
Zod contract) · `packages/prompts` (versioned prompt). See `AGENTS.md`,
`docs/code-structure.md`, `docs/db-schema.md`, and `DECISIONS.md`.

## Requirements

- **Node ≥ 22.13** (pnpm 11 requires it — see `.nvmrc`)
- **pnpm 11** (`corepack enable` will pick the pinned version)

## Local development

```bash
pnpm install                 # installs all workspaces; builds the Prisma client
cp apps/api/.env.example apps/api/.env   # then set GROQ_API_KEY
cp apps/web/.env.example apps/web/.env.local

pnpm --filter api exec prisma migrate dev   # create the SQLite db (apps/api/dev.db)

pnpm dev                     # runs api (:3001) + web (:3000) via turbo
```

- API: http://localhost:3001 (health: `GET /health`)
- Web: http://localhost:3000

Env vars (`apps/api/.env`): `GROQ_API_KEY`, `GROQ_MODEL`, `DATABASE_URL`,
`PORT`, `WEB_ORIGIN`, `PROMPT_VERSION`. Web (`apps/web/.env.local`):
`NEXT_PUBLIC_API_URL`.

## Seeding sample data

Two ways to load the bundled sample week (`data/`), split into night shifts with a
handover generated per night so reconciliation builds up:

1. **Script** (API must be running):
   ```bash
   pnpm --filter api seed
   # or: API_BASE=http://localhost:3001 HOTEL_ID=lumen-sg node apps/api/scripts/seed.mjs
   ```
2. **From the UI / API**: the **Reset & seed sample** button, or
   `curl -X POST http://localhost:3001/hotels/lumen-sg/seed`. This clears the
   hotel first, then reloads and regenerates.

Generate a handover by hand:
```bash
curl -X POST http://localhost:3001/hotels/lumen-sg/handover
curl http://localhost:3001/hotels/lumen-sg/handovers
```

## Key endpoints (all per-hotel scoped)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/ingest` | Ingest a shift (STRUCTURED derives its date; FREE_TEXT needs `nightOf`) |
| POST | `/hotels/:hotelId/handover` | Generate the action-first handover (latest shift, or `{ shiftId }`) |
| GET | `/hotels/:hotelId/handovers` `/handovers/:id` | Handover history + detail (with grounded sources) |
| GET | `/hotels/:hotelId/raw-logs` `/generation-logs` | Raw night logs · structured run logs |
| POST | `/hotels/:hotelId/seed` | Clear + reload the sample week |
| DELETE | `/hotels/:hotelId/data` | Clear all data for the hotel |

## Deployment (Railway)

This is a stateful NestJS server + SQLite, so it needs a platform that runs a
persistent process with a writable disk (Railway / Render / Fly) — **not** a
serverless one like Vercel (read-only FS, no persistent SQLite).

On Railway, keep the service **Root Directory at the repo root** (monorepo), then:

- **Build command:** `pnpm exec turbo run build --filter=api`
- **Start command:** `pnpm --filter api run start:prod`
  (runs `prisma migrate deploy` then `node dist/main`)
- **Variables:** `GROQ_API_KEY`, `GROQ_MODEL=llama-3.3-70b-versatile`,
  `DATABASE_URL=file:./dev.db`, `WEB_ORIGIN=<your web origin>`
  (`PORT` is provided by Railway automatically).

The container filesystem is ephemeral across deploys, so SQLite data resets on
redeploy — repopulate with `POST /hotels/:hotelId/seed`. For persistence, attach a
Railway **Volume** (e.g. mounted at `/data`) and set `DATABASE_URL=file:/data/dev.db`.

Sanity check after deploy:
```bash
curl https://<your-app>.up.railway.app/health
```

