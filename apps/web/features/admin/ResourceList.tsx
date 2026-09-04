'use client';

import { useEffect, useState } from 'react';

/** Generic read-only admin list: renders an array of records as a table of primitive fields. */
export function ResourceList({
  title,
  description,
  load,
}: {
  title: string;
  description: string;
  load: () => Promise<unknown[]>;
}): React.JSX.Element {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then((r) => setRows((Array.isArray(r) ? r : []) as Record<string, unknown>[]))
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Choose columns: primitive-valued keys from the first few rows.
  const cols = Array.from(
    new Set(
      rows.slice(0, 5).flatMap((r) =>
        Object.entries(r)
          .filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))
          .map(([k]) => k),
      ),
    ),
  ).slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        <p className="text-sm text-secondary">{description}{rows.length ? ` · ${rows.length} items` : ''}</p>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-surface-alt" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-10 text-center text-secondary">No records.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-secondary">
              <tr>{cols.map((c) => <th key={c} className="px-4 py-3 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={(r.id as string) ?? i} className="border-b border-border hover:bg-background">
                  {cols.map((c) => (
                    <td key={c} className="max-w-[240px] truncate px-4 py-3 text-text">
                      {r[c] === null || r[c] === undefined ? '—' : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-secondary">Read-only view. Create/edit tools coming soon.</p>
    </div>
  );
}
