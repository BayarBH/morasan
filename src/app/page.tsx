'use client';
import { useEffect, useState } from 'react';
import { FIELDS, type Field, type RequestRecord } from '@/core/schemas';
import type { Preset } from '@/lib/presets';
import { api, useUser } from '@/lib/session';
import { ResultCard } from '@/components/ui';

type Result = { record: RequestRecord; rows: Record<string, unknown>[] | null };

export default function ConsolePage() {
  const user = useUser();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purpose, setPurpose] = useState('');
  const [fields, setFields] = useState<Field[]>(['name', 'phone']);
  const [rowCount, setRowCount] = useState(1);
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [memberIds, setMemberIds] = useState('');

  useEffect(() => {
    if (user) api<{ presets: Preset[] }>('/api/presets').then((r) => setPresets(r.presets)).catch((e) => setError(e.message));
  }, [user]);

  async function submit(key: string, body: unknown) {
    setBusy(key);
    setError(null);
    setResult(null);
    try {
      setResult(await api<Result>('/api/gateway/request', { method: 'POST', body }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function onCustom(e: React.FormEvent) {
    e.preventDefault();
    const ids = memberIds.split(/[\s,、]+/).filter(Boolean);
    submit('custom', { custom: { purpose, fields, rowCount, scope, ...(ids.length ? { memberIds: ids } : {}) } });
  }

  if (!user) return <p className="text-sm text-slate-500">読み込み中です…</p>;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-2xl font-semibold tracking-wide">AIは止められるが、出せない。</p>
        <p className="mt-1 text-sm text-slate-600">
          顧客データを読むときは、AIエージェントもスタッフも必ずこのゲートウェイを通ります。出力を決めるのは決定的なルールと、事前に決められたデータオーナーだけです。
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">デモ用リクエスト</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((p, i) => (
            <button key={p.id} disabled={!!busy} onClick={() => submit(p.id, { presetId: p.id })}
              className="rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-indigo-400 hover:shadow-sm disabled:opacity-50">
              <p className="text-sm font-medium">{i + 1}. {p.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {p.input.fields.join(', ')} ・ {p.input.memberIds ? p.input.memberIds.join(', ') : `${p.input.rowCount}件`}
              </p>
              <p className="mt-1 text-xs text-slate-500">想定：{p.expect}</p>
              {busy === p.id && <p className="mt-1 text-xs text-indigo-700">確認中です…</p>}
            </button>
          ))}
        </div>
      </section>

      {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {result && <ResultCard record={result.record} rows={result.rows} />}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">カスタムリクエスト（{user.email} として依頼します）</h2>
        <form onSubmit={onCustom} className="space-y-3 text-sm">
          <label className="block">
            利用目的
            <textarea required maxLength={500} value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2" placeholder="例：予約変更のご連絡のため" />
          </label>
          <fieldset>
            <legend>要求項目</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {FIELDS.map((f) => (
                <label key={f} className="flex items-center gap-1">
                  <input type="checkbox" checked={fields.includes(f)}
                    onChange={(e) => setFields(e.target.checked ? [...fields, f] : fields.filter((x) => x !== f))} />
                  {f}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-4">
            <label>件数 <input type="number" min={1} max={100000} value={rowCount} onChange={(e) => setRowCount(Number(e.target.value))}
              className="ml-1 w-24 rounded border border-slate-300 px-2 py-1" /></label>
            <label>範囲{' '}
              <select value={scope} onChange={(e) => setScope(e.target.value as 'active' | 'all')} className="ml-1 rounded border border-slate-300 px-2 py-1">
                <option value="active">在籍会員のみ</option>
                <option value="all">退会済みを含む</option>
              </select>
            </label>
            <label>会員ID（任意）<input value={memberIds} onChange={(e) => setMemberIds(e.target.value)} placeholder="M-000123, M-000045"
              className="ml-1 w-56 rounded border border-slate-300 px-2 py-1" /></label>
          </div>
          <button type="submit" disabled={!!busy || !fields.length} className="rounded bg-indigo-700 px-4 py-2 text-white hover:bg-indigo-800 disabled:opacity-50">
            {busy === 'custom' ? '確認中です…' : 'ゲートウェイに依頼する'}
          </button>
        </form>
      </section>
    </div>
  );
}
