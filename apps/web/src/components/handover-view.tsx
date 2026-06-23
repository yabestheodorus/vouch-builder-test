import type { Bucket, Handover, HandoverItem } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

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

// Flags that signal the operator should not take the statement at face value.
const ALARMING_FLAGS = new Set(['contradiction', 'injection_attempt']);

function FlagBadge({ flag }: { flag: string }) {
  const alarming = ALARMING_FLAGS.has(flag);
  return (
    <Badge variant={alarming ? 'destructive' : 'outline'} className="font-normal">
      {flag}
    </Badge>
  );
}

function Item({ item }: { item: HandoverItem }) {
  return (
    <li className="rounded-md border bg-card p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-normal">
          {RECONCILE_LABEL[item.reconcileTag]}
        </Badge>
        {item.flags.map((f) => (
          <FlagBadge key={f} flag={f} />
        ))}
      </div>
      <p className="whitespace-pre-wrap">{item.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <span>source:</span>
        {item.sourceRefs.length === 0 ? (
          <span className="text-red-600">none (ungrounded!)</span>
        ) : (
          item.sourceRefs.map((ref) => (
            <code key={ref} className="rounded bg-muted px-1 py-0.5 font-mono">
              {ref}
            </code>
          ))
        )}
      </div>
    </li>
  );
}

export function HandoverView({ handover }: { handover: Handover }) {
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
              <span className="text-xs font-normal text-muted-foreground">
                ({items.length})
              </span>
            </h3>
            {items.length === 0 ? (
              <p className="py-1 text-sm text-muted-foreground">Nothing here.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {items.map((item, idx) => (
                  <Item key={item.id ?? idx} item={item} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
