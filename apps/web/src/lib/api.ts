// Typed client for the NestJS handover API. All reads are scoped per hotel.

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type Bucket = 'ON_FIRE' | 'PENDING' | 'FYI';
export type ReconcileTag = 'NEW' | 'STILL_OPEN' | 'NEWLY_RESOLVED';

export interface HandoverItem {
  id?: string;
  bucket: Bucket;
  reconcileTag: ReconcileTag;
  issueId: string | null;
  text: string;
  why: string;
  sourceRefs: string[];
  flags: string[];
}

export interface ResolvedSource {
  ref: string;
  text: string;
  room: string | null;
  occurredAt: string | null;
  category: string;
  format: 'STRUCTURED' | 'FREE_TEXT';
  nightOf: string | null;
}

export interface Handover {
  id: string;
  hotelId: string;
  shiftId: string;
  generatedAt: string;
  model: string;
  promptVersion: string;
  summary: string | null;
  items: HandoverItem[];
  // ref -> raw source text, for clickable citations
  sources: Record<string, ResolvedSource>;
}

export interface HandoverSummary {
  id: string;
  shiftId: string;
  generatedAt: string;
  model: string;
  promptVersion: string;
  summary: string | null;
  itemCount: number;
}

export interface RawLog {
  id: string;
  shiftId: string;
  nightOf: string;
  format: 'STRUCTURED' | 'FREE_TEXT';
  content: string;
  receivedAt: string;
}

export interface GenerationLog {
  id: string;
  shiftId: string | null;
  handoverId: string | null;
  startedAt: string;
  durationMs: number;
  model: string;
  promptVersion: string;
  outcome: 'OK' | 'REPAIRED' | 'DEGRADED' | 'FAILED';
  inputCounts: { events: number; openIssuesIn: number } | null;
  reasoning: string;
  flags: string[];
  tokenUsage: unknown;
  error: string | null;
}

export interface IngestPayload {
  hotelId: string;
  // Required only for FREE_TEXT; STRUCTURED derives dates from the data.
  nightOf?: string;
  sources: Array<{ format: 'STRUCTURED' | 'FREE_TEXT'; content: string }>;
}

export interface IngestResult {
  hotelId: string;
  shifts: Array<{
    shiftId: string;
    nightOf: string;
    format: 'STRUCTURED' | 'FREE_TEXT';
    events: number;
  }>;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = res.statusText;
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  generateHandover: (hotelId: string, shiftId?: string) =>
    http<Handover>(`/hotels/${encodeURIComponent(hotelId)}/handover`, {
      method: 'POST',
      body: JSON.stringify(shiftId ? { shiftId } : {}),
    }),
  listHandovers: (hotelId: string) =>
    http<HandoverSummary[]>(`/hotels/${encodeURIComponent(hotelId)}/handovers`),
  getHandover: (hotelId: string, id: string) =>
    http<Handover>(
      `/hotels/${encodeURIComponent(hotelId)}/handovers/${encodeURIComponent(id)}`,
    ),
  listRawLogs: (hotelId: string) =>
    http<RawLog[]>(`/hotels/${encodeURIComponent(hotelId)}/raw-logs`),
  listGenerationLogs: (hotelId: string) =>
    http<GenerationLog[]>(
      `/hotels/${encodeURIComponent(hotelId)}/generation-logs`,
    ),
  ingest: (payload: IngestPayload) =>
    http<IngestResult>(`/ingest`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  clearHotel: (hotelId: string) =>
    http<{ hotelId: string; cleared: true }>(
      `/hotels/${encodeURIComponent(hotelId)}/data`,
      { method: 'DELETE' },
    ),
  reseed: (hotelId: string) =>
    http<{ hotelId: string; shifts: number; handovers: Array<{ nightOf: string; items: number }> }>(
      `/hotels/${encodeURIComponent(hotelId)}/seed`,
      { method: 'POST' },
    ),
};
