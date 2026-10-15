'use client';
import { use, useEffect, useState } from 'react';
import type { AuditEvent, RequestRecord } from '@/core/schemas';
import { api, useUser } from '@/lib/session';
import { AuditTable, ResultCard, fmt } from '@/components/ui';

type Detail = { record: RequestRecord; rows: Record<string, unknown>[] | null; events: AuditEvent[] };

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) api<Detail>(`/api/requests/${id}`).then(setD).catch((e) => setError(e.message));
  }, [user, id]);

  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>;
  if (!d) return <p className="text-sm text-slate-500">読み込み中です…</p>;
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">リクエスト詳細 <span className="text-sm font-normal text-slate-500">{d.record.id.slice(0, 8)} ・ {fmt(d.record.createdAt)}</span></h2>
      <ResultCard record={d.record} rows={d.rows} />
      <h3 className="font-semibold">このリクエストの記録</h3>
      <AuditTable events={d.events} />
    </div>
  );
}
