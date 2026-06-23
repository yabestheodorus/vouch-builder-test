'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type GenerationLog,
  type Handover,
  type HandoverSummary,
  type RawLog,
} from '@/lib/api';
import { HandoverView } from '@/components/handover-view';
import { IngestPanel } from '@/components/ingest-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const OUTCOME_VARIANT: Record<
  GenerationLog['outcome'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  OK: 'default',
  REPAIRED: 'secondary',
  DEGRADED: 'outline',
  FAILED: 'destructive',
};

export default function Home() {
  const [hotelId, setHotelId] = useState('lumen-sg');
  const [hotelInput, setHotelInput] = useState('lumen-sg');

  const [handover, setHandover] = useState<Handover | null>(null);
  const [handovers, setHandovers] = useState<HandoverSummary[]>([]);
  const [rawLogs, setRawLogs] = useState<RawLog[]>([]);
  const [genLogs, setGenLogs] = useState<GenerationLog[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [hs, rl, gl] = await Promise.all([
        api.listHandovers(hotelId),
        api.listRawLogs(hotelId),
        api.listGenerationLogs(hotelId),
      ]);
      setHandovers(hs);
      setRawLogs(rl);
      setGenLogs(gl);
      if (hs.length > 0) {
        setHandover(await api.getHandover(hotelId, hs[0].id));
      } else {
        setHandover(null);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const h = await api.generateHandover(hotelId);
      setHandover(h);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openHandover(id: string) {
    try {
      setHandover(await api.getHandover(hotelId, id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function resetAndSeed() {
    if (
      !confirm(
        `Clear ALL data for hotel "${hotelId}" and reload the sample week?\n` +
          `This wipes existing data and generates a fresh handover per night.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setHandover(null);
      await api.reseed(hotelId); // clears + ingests sample + generates per shift
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Night-Shift Handover</h1>
        <p className="text-sm text-muted-foreground">
          Action-first morning handover, grounded in the night team&apos;s logs.
        </p>
        <div className="mt-3 flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Hotel ID</span>
            <input
              value={hotelInput}
              onChange={(e) => setHotelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setHotelId(hotelInput.trim())}
              className="rounded-md border bg-background px-2 py-1"
            />
          </label>
          <Button variant="secondary" onClick={() => setHotelId(hotelInput.trim())}>
            Load
          </Button>
          <Button variant="destructive" onClick={resetAndSeed} disabled={busy}>
            {busy ? 'Resetting…' : 'Reset & seed sample'}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Reset &amp; seed wipes this hotel and reloads the sample week (a handover
          per night). Or ingest your own shift in the Ingest tab.
        </p>
        {error && (
          <p className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </header>

      <Tabs defaultValue="handover">
        <TabsList>
          <TabsTrigger value="handover">Latest handover</TabsTrigger>
          <TabsTrigger value="history">Past handovers ({handovers.length})</TabsTrigger>
          <TabsTrigger value="raw">Night logs ({rawLogs.length})</TabsTrigger>
          <TabsTrigger value="runs">Generation logs ({genLogs.length})</TabsTrigger>
          <TabsTrigger value="ingest">Ingest</TabsTrigger>
        </TabsList>

        {/* Action-first handover */}
        <TabsContent value="handover" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            The action-first handover for the most recent shift. Click any source
            ref to see the raw text it&apos;s grounded in.
          </p>
          <Button onClick={generate} disabled={busy}>
            {busy ? 'Generating…' : 'Generate handover (latest shift)'}
          </Button>
          {handover ? (
            <HandoverView handover={handover} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No handover yet. Ingest a shift, then generate.
            </p>
          )}
        </TabsContent>

        {/* Handover history */}
        <TabsContent value="history" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Every handover generated for this hotel, newest first. Click one to open it.
          </p>
          {handovers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No handovers yet.</p>
          ) : (
            <ul className="space-y-2">
              {handovers.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => openHandover(h.id)}
                    className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {h.summary ?? '(no summary)'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {h.itemCount} items · model {h.model} · prompt {h.promptVersion}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Raw shift logs */}
        <TabsContent value="raw" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            The original night-shift input as ingested (structured JSON or
            free-text prose), stored verbatim per shift.
          </p>
          {rawLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No raw logs yet.</p>
          ) : (
            <ul className="space-y-2">
              {rawLogs.map((r) => (
                <li key={r.id} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{r.format}</Badge>
                    <span>night of {new Date(r.nightOf).toLocaleDateString()}</span>
                    <span>· {new Date(r.receivedAt).toLocaleString()}</span>
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                    {r.content}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Generation (run) logs */}
        <TabsContent value="runs" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            One record per generation run, for debugging: which night, the model
            &amp; prompt version, inputs seen, the model&apos;s reasoning, any
            grounding flags, and the outcome (OK / repaired / degraded / failed).
          </p>
          {genLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <ul className="space-y-2">
              {genLogs.map((g) => (
                <li key={g.id} className="rounded-md border p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={OUTCOME_VARIANT[g.outcome]}>{g.outcome}</Badge>
                    <span>{new Date(g.startedAt).toLocaleString()}</span>
                    <span>· {g.durationMs}ms · model {g.model} · prompt {g.promptVersion}</span>
                    {g.inputCounts && (
                      <span>
                        · {g.inputCounts.events} events, {g.inputCounts.openIssuesIn} open issues
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{g.reasoning}</p>
                  {g.flags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {g.flags.map((f) => (
                        <Badge key={f} variant="outline" className="font-normal">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {g.error && <p className="mt-1 text-xs text-red-600">{g.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Ingest */}
        <TabsContent value="ingest" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Add a night&apos;s log as data. Structured JSON derives its date(s)
            from event timestamps; free text needs a night date.
          </p>
          <IngestPanel hotelId={hotelId} onIngested={load} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
