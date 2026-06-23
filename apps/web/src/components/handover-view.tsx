'use client';

import { useState } from 'react';
import type { Bucket, Handover, HandoverItem, ResolvedSource } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const BUCKETS: { key: Bucket; label: string; hint: string; accent: string }[] = [
  { key: 'ON_FIRE', label: 'On fire', hint: 'Act immediately', accent: 'border-l-red-500' },
  { key: 'PENDING', label: 'Pending', hint: 'Follow up, not urgent', accent: 'border-l-amber-500' },
  { key: 'FYI', label: 'FYI', hint: 'Informational', accent: 'border-l-zinc-400' },
];

const RECONCILE_LABEL: Record<HandoverItem['reconcileTag'], string> = {
  NEW: 'New tonight',
  STILL_OPEN: 'Still open',
  NEWLY_RESOLVED: 'Newly resolved',
};

const ALARMING_FLAGS = new Set(['contradiction', 'injection_attempt']);

export function HandoverView({ handover }: { handover: Handover }) {
  const [openSource, setOpenSource] = useState<ResolvedSource | null>(null);
  const [openRef, setOpenRef] = useState<string | null>(null);

  function showSource(ref: string) {
    setOpenRef(ref);
    setOpenSource(handover.sources[ref] ?? null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="font-medium">{handover.summary ?? '(no summary)'}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          generated {new Date(handover.generatedAt).toLocaleString()} · model{' '}
          {handover.model} · prompt {handover.promptVersion} · {handover.items.length} items
        </p>
      </div>

      {BUCKETS.map(({ key, label, hint, accent }) => {
        const items = handover.items.filter((i) => i.bucket === key);
        return (
          <section key={key} className={`border-l-4 pl-3 ${accent}`}>
            <h3 className="flex items-baseline gap-2 font-semibold">
              {label}
              <span className="text-xs font-normal text-muted-foreground">{hint}</span>
              <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
            </h3>
            {items.length === 0 ? (
              <p className="py-1 text-sm text-muted-foreground">Nothing here.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {items.map((item, idx) => (
                  <li key={item.id ?? idx} className="rounded-md border bg-card p-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-normal">
                        {RECONCILE_LABEL[item.reconcileTag]}
                      </Badge>
                      {item.flags.map((f) => (
                        <Badge
                          key={f}
                          variant={ALARMING_FLAGS.has(f) ? 'destructive' : 'outline'}
                          className="font-normal"
                        >
                          {f}
                        </Badge>
                      ))}
                    </div>
                    <p className="whitespace-pre-wrap">{item.text}</p>
                    <p className="mt-1 text-xs italic text-muted-foreground">why: {item.why}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <span>source:</span>
                      {item.sourceRefs.length === 0 ? (
                        <span className="text-red-600">none (ungrounded!)</span>
                      ) : (
                        item.sourceRefs.map((ref) => (
                          <button
                            key={ref}
                            onClick={() => showSource(ref)}
                            className="rounded bg-muted px-1 py-0.5 font-mono underline decoration-dotted underline-offset-2 hover:bg-accent"
                            title="View raw source text"
                          >
                            {ref}
                          </button>
                        ))
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <Dialog open={openRef !== null} onOpenChange={(o) => !o && setOpenRef(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{openRef}</DialogTitle>
            <DialogDescription>
              {openSource
                ? `${openSource.format}${openSource.room ? ` · room ${openSource.room}` : ''}` +
                  `${openSource.occurredAt ? ` · ${new Date(openSource.occurredAt).toLocaleString()}` : ''}`
                : 'Raw source'}
            </DialogDescription>
          </DialogHeader>
          {openSource ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-sm">
              {openSource.text}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Source text not found for this ref.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
