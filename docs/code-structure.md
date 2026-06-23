# Code Structure & Standards

How the monorepo is laid out and the conventions every file follows. See
[`AGENTS.md`](../AGENTS.md) for the rules this structure exists to enforce.

## 1. Monorepo layout (Turborepo + pnpm)

```
vouch-frontdesk-hotel-log/
├─ apps/
│  ├─ api/                      # NestJS backend
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ hotels/             # hotel registry (read), per-hotel scoping
│  │  │  ├─ ingest/             # accept JSON + free-text, normalize to events
│  │  │  ├─ reconcile/          # open-issue state machine across nights
│  │  │  ├─ handover/           # orchestrates a generate-handover run
│  │  │  ├─ llm/                # Groq client, prompt assembly, output parsing
│  │  │  ├─ logging/            # structured run-log writer
│  │  │  └─ prisma/             # PrismaService (DB access)
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  └─ migrations/
│  │  └─ test/
│  └─ web/                      # Next.js frontend
│     └─ src/
│        ├─ app/                # routes: handovers / raw-logs / generation-logs
│        ├─ components/
│        └─ lib/                # typed API client (consumes @vouch/schema)
├─ packages/
│  ├─ schema/                   # @vouch/schema — Zod schemas + inferred types
│  │  └─ src/
│  │     ├─ events.ts           # normalized event, source refs
│  │     ├─ issue.ts            # open-issue / reconciliation state
│  │     ├─ handover.ts         # On fire / Pending / FYI output contract
│  │     └─ index.ts
│  ├─ prompts/                  # versioned prompt templates (no hotel specifics)
│  └─ config/                   # shared tsconfig / eslint / prettier
├─ data/                        # sample week (test fixtures only — never hard-code)
├─ docs/
├─ AGENTS.md  CLAUDE.md  DECISIONS.md  BRIEF.md
└─ turbo.json  pnpm-workspace.yaml
```

### Why this shape
- **`packages/schema` is the contract.** Backend and frontend both import the same
  Zod schemas and inferred types — no drift between API and UI. Zod is the single
  source of truth; TS types are `z.infer`, never hand-written duplicates.
- **`packages/prompts` is data, not code paths.** Templates are versioned and free
  of any hotel-specific value (Generalizability, AGENTS §3.1). Hotel data is
  injected at runtime by `apps/api/src/llm`.
- **The pipeline is split by responsibility** (`ingest → reconcile → handover →
  llm → logging`) so grounding and per-hotel scoping are enforced at each seam, not
  smeared across one service.

## 2. The pipeline (request lifecycle)

```
POST /hotels/:hotelId/handover
        │
   ingest      normalize JSON events + free-text lines → NormalizedEvent[]
        │       (each keeps a sourceRef back to its origin)
   reconcile   load OPEN issues for :hotelId → diff vs this shift →
        │       classify New / Still open / Newly resolved → persist new state
   handover    assemble grounded context (events + issue deltas, all with refs)
        │
   llm         dynamic per-hotel prompt → Groq → Zod-validate output
        │       (malformed → repair → degraded fallback; never throw raw)
   logging     write GenerationLog (hotelId, night, model, reasoning, flags)
        │
   persist     store Handover + items (each with sourceRefs) → return JSON
```

Every box is scoped by `hotelId`. There is no code path that reads another hotel's
data into this run.

## 3. Code standards

### Language & tooling
- **TypeScript strict** everywhere (`strict: true`, `noUncheckedIndexedAccess`).
  No `any` — use `unknown` + a Zod parse at the boundary.
- **ESLint + Prettier** from `packages/config`; CI fails on lint/format errors.
- **ESM**, Node 20+. Module path aliases via tsconfig `paths`.

### Validation & boundaries (Reliability, AGENTS §3.2)
- **Parse, don't trust.** Validate with Zod at every boundary: HTTP request bodies
  (Nest `ZodValidationPipe`), **every LLM response**, and DB rows that get fed into
  a prompt.
- **LLM output is never trusted.** `llm/` returns a `Result`-style outcome:
  `{ ok, data }` on a clean Zod parse, otherwise a repair attempt, otherwise an
  explicitly-degraded handover. No `JSON.parse` result reaches business logic
  un-validated, and a parse failure is logged, not thrown to the client.
- **UTF-8 only.** No encoding assumptions, no normalization that drops characters.
  Strings are stored and compared as-is. Tests include non-Latin round-trips.

### Isolation (AGENTS §3.3)
- `hotelId` is a required parameter on every service method that touches data —
  never an optional/ambient value. Repositories take `hotelId` first.
- No global mutable state holds hotel data between requests.

### Grounding in code (AGENTS §3.5)
- `sourceRef` travels with data from `ingest` through to each `HandoverItem`. A
  handover item without at least one `sourceRef` is invalid by schema.
- Contradictions/missing data are first-class: items carry a `flags[]` field
  (`contradiction`, `incomplete`, `unverified`, `injection_attempt`) rather than
  being silently resolved.
- Log content passed to the model is wrapped in explicit delimiters and labelled as
  untrusted data; prompt instructions live outside that block.

### Naming & files
- Files `kebab-case.ts`; classes `PascalCase`; vars/functions `camelCase`;
  Zod schemas `XxxSchema` with type `Xxx = z.infer<typeof XxxSchema>`.
- One Nest module per pipeline stage; keep services small and pure where possible
  (pure normalize/reconcile functions are easy to unit-test).
- Prompt templates carry a `version` string; bump it on any wording change so logs
  can tie an output to the exact prompt that produced it.

### Testing
- **Unit:** normalization and reconciliation are pure functions — test multi-night
  sequences (carry-over, resolve, re-open) against `data/` fixtures.
- **Contract:** golden Zod parse tests for handover output, including malformed and
  injection inputs (assert the injection is flagged, not obeyed).
- **No network in tests** — mock the Groq client.

### Commits
- Small, focused, conventional-ish messages; **do not squash** (the brief wants
  full history). One logical change per commit.

## 4. Configuration

- Secrets and env in `.env` (gitignored); commit `.env.example` with keys only:
  `GROQ_API_KEY`, `DATABASE_URL`, `GROQ_MODEL`, `PROMPT_VERSION`.
- SQLite file path via `DATABASE_URL`; migrations checked in under
  `apps/api/prisma/migrations`.
