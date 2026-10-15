'use client';
import { useEffect, useState } from 'react';
import type { AuditEvent } from '@/core/schemas';
import { api, useUser } from '@/lib/session';
import { AuditTable, fmt } from '@/components/ui';

export default function AuditPage() {
  const user = useUser();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) api<{ events: AuditEvent[] }>('/api/audit').then((r) => setEvents(r.events)).catch((e) => setError(e.message));
  }, [user]);

  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>;
  if (!events) return <p className="text-sm text-slate-500">読み込み中です…</p>;
  const alerts = events.filter((e) => e.action === 'canary.alert');

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <section role="alert" className="rounded-lg border border-rose-400 bg-rose-600 p-4 text-white">
          <p className="font-semibold">カナリア警報：おとりレコードへのアクセスが {alerts.length} 件検知されています。</p>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.id}>
                {fmt(a.ts)} ・ <a href={`/requests/${a.requestId}`} className="underline underline-offset-2">{a.requestId.slice(0, 8)}</a> ・ {a.detail}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div>
        <h2 className="font-semibold">ブラックボックス</h2>
        <p className="text-sm text-slate-600">すべての判断を、ルールIDとポリシーハッシュ付きで記録しています。個人データそのものは記録しません。</p>
      </div>
      <AuditTable events={events} />
    </div>
  );
}
