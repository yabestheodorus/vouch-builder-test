'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

/**
 * Minimal ingest form so the app is usable without curl. Input is data: paste
 * structured JSON or free-text prose for one shift. Mirrors POST /ingest.
 */
export function IngestPanel({
  hotelId,
  onIngested,
}: {
  hotelId: string;
  onIngested: () => void;
}) {
  const [nightOf, setNightOf] = useState('2026-05-25');
  const [format, setFormat] = useState<'STRUCTURED' | 'FREE_TEXT'>('STRUCTURED');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.ingest({
        hotelId,
        nightOf,
        startsAt: `${nightOf}T23:00:00+08:00`,
        endsAt: `${nightOf}T07:00:00+08:00`,
        sources: [{ format, content }],
      });
      setResult(`Ingested ${r.events} events into shift ${r.shiftId}.`);
      setContent('');
      onIngested();
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Night of (start date)</span>
          <input
            type="date"
            value={nightOf}
            onChange={(e) => setNightOf(e.target.value)}
            className="rounded-md border bg-background px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            className="rounded-md border bg-background px-2 py-1"
          >
            <option value="STRUCTURED">STRUCTURED (JSON)</option>
            <option value="FREE_TEXT">FREE_TEXT (prose)</option>
          </select>
        </label>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          format === 'STRUCTURED'
            ? '{ "events": [ ... ] }  — paste the structured JSON'
            : 'Paste the free-text night log (any language)…'
        }
        rows={10}
        className="w-full rounded-md border bg-background p-2 font-mono text-xs"
      />
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy || content.trim().length === 0}>
          {busy ? 'Ingesting…' : 'Ingest shift'}
        </Button>
        {result && <span className="text-sm text-muted-foreground">{result}</span>}
      </div>
    </div>
  );
}
