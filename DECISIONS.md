# DECISIONS.md

> Owned by the human builder. Skeleton below mirrors the headings required by
> `BRIEF.md` §4. Fill in as you build — record real tradeoffs, not aspirations.

## Stack
- Turborepo (pnpm) · NestJS · Next.js · Zod · Groq · SQLite + Prisma.
- _Why this stack:_ <!-- TODO -->

## 1. What I built and what I deliberately skipped (and why)
- Built:
- Skipped (and why):

## 2. How I handle reconciliation across nights
- <!-- open-issue state model, how New / Still open / Newly resolved is decided,
      how state persists per hotel for the next night -->

## 3. Grounding — keeping every statement traceable, handling incomplete/contradictory input, and stopping the model inventing facts
- Traceability (sourceRefs):
- Incomplete / contradictory handling (flags):
- Prompt-injection / untrusted-data handling:
- Malformed-output handling (Zod validate → repair → degrade):

## 4. Where AI helped most, and where it got in the way
- Helped:
- Got in the way:

## 5. What I'd do in hours 3–6
-

## 6. One thing that surprised me
-
