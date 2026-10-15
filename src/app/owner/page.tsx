'use client';
import { useCallback, useEffect, useState } from 'react';
import type { RequestRecord } from '@/core/schemas';
import { api, useUser } from '@/lib/session';
import { AiOpinion, Hits, OutcomeBadge, STATUS_JA, fmt } from '@/components/ui';

type Me = { email: string; role: 'owner' | 'staff' };

export default function OwnerPage() {
  const user = useUser();
  const [me, setMe] = useState<Me | null>(null);
  const [requests, setRequests] = useState<RequestRecord[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ requests: RequestRecord[] }>('/api/requests').then((r) => setRequests(r.requests)), []);
  useEffect(() => {
    if (!user) return;
    api<Me>('/api/me').then(setMe);
    load().catch((e) => setMsg({ ok: false, text: e.message }));
  }, [user, load]);

  async function decide(id: string, decision: 'approve' | 'deny') {
    setBusy(true);
    setMsg(null);
    try {
      await api('/api/owner/decide', { method: 'POST', body: { requestId: id, decision, note: notes[id] ?? '' } });
      setMsg({ ok: true, text: decision === 'approve' ? '承認しました。' : '拒否しました。' });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!requests || !me) return <p className="text-sm text-slate-500">読み込み中です…</p>;
  const held = requests.filter((r) => r.status === 'held');
  const decided = requests.filter((r) => r.ownerDecision).slice(0, 10);

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">データオーナー受信箱</h2>
      {me.role !== 'owner' && (
        <p className="rounded border border-slate-300 bg-slate-100 p-3 text-sm">
          閲覧のみです。承認・拒否できるのは、事前に指定されたデータオーナーだけです。操作を試みた場合は拒否され、ブラックボックスに記録されます。
        </p>
      )}
      {msg && <p role="alert" className={`rounded border p-3 text-sm ${msg.ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{msg.text}</p>}
      {!held.length && <p className="text-sm text-slate-500">判断待ちのリクエストはありません。</p>}
      {held.map((r) => (
        <section key={r.id} className={`space-y-3 rounded-lg border bg-white p-4 ${r.canaryAlert ? 'border-rose-400' : 'border-amber-300'}`}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <OutcomeBadge outcome={r.finalOutcome} />
            {r.canaryAlert && <span className="rounded bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">カナリア警報</span>}
            <span>{r.input.requester.name}（{r.input.requester.kind}）</span>
            <span className="text-slate-500">{fmt(r.createdAt)}</span>
            <a href={`/requests/${r.id}`} className="ml-auto text-indigo-700 underline underline-offset-2">詳細</a>
          </div>
          <p className="text-sm"><span className="text-slate-500">目的：</span>{r.input.purpose}</p>
          <p className="text-sm"><span className="text-slate-500">項目：</span>{r.input.fields.join(', ')} ・ {r.rules.selectedMemberIds.length}件</p>
          <Hits record={r} />
          <AiOpinion record={r} />
          <div className="flex flex-wrap items-center gap-2">
            <input value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={500}
              placeholder="判断メモ（任意）" className="min-w-60 flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
            <button disabled={busy} onClick={() => decide(r.id, 'approve')}
              className="rounded bg-emerald-700 px-3 py-1 text-sm text-white hover:bg-emerald-800 disabled:opacity-50">承認する</button>
            <button disabled={busy} onClick={() => decide(r.id, 'deny')}
              className="rounded bg-rose-700 px-3 py-1 text-sm text-white hover:bg-rose-800 disabled:opacity-50">拒否する</button>
          </div>
        </section>
      ))}
      {decided.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">最近の判断</h3>
          <ul className="space-y-1 text-sm">
            {decided.map((r) => (
              <li key={r.id}>
                <a href={`/requests/${r.id}`} className="text-indigo-700 underline underline-offset-2">{r.id.slice(0, 8)}</a>{' '}
                {STATUS_JA[r.status]} ・ {r.ownerDecision!.byEmail} ・ {fmt(r.ownerDecision!.at)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
