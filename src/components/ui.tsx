import type { AuditEvent, Outcome, RequestRecord } from '@/core/schemas';

const BADGE: Record<Outcome, [string, string]> = {
  release: ['出力', 'bg-emerald-100 text-emerald-800 border-emerald-300'],
  mask: ['マスクして出力', 'bg-sky-100 text-sky-800 border-sky-300'],
  hold: ['保留（データオーナー判断待ち）', 'bg-amber-100 text-amber-900 border-amber-300'],
  deny: ['拒否', 'bg-rose-100 text-rose-800 border-rose-300'],
};

export const OutcomeBadge = ({ outcome }: { outcome: Outcome }) => (
  <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${BADGE[outcome][1]}`}>{BADGE[outcome][0]}</span>
);

export const STATUS_JA: Record<RequestRecord['status'], string> = {
  released: '出力済み', masked: 'マスクして出力済み', held: '保留中', denied: '拒否', approved: 'オーナー承認済み', owner_denied: 'オーナー拒否',
};

export const fmt = (iso: string) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

export function Hits({ record }: { record: RequestRecord }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {record.hits.map((h, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-2">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{h.ruleId}</code>
          <OutcomeBadge outcome={h.outcome} />
          <span>{h.reason}</span>
        </li>
      ))}
    </ul>
  );
}

export function AiOpinion({ record }: { record: RequestRecord }) {
  const { ai } = record;
  return (
    <div className="rounded border border-violet-200 bg-violet-50 p-3 text-sm">
      <p className="mb-1 font-medium text-violet-900">AIの意見（止めることしかできません）</p>
      {ai.review ? (
        <p>
          判定：<b>{ai.review.verdict}</b>
          {ai.review.maskFields.length > 0 && <>（伏せ字：{ai.review.maskFields.join(', ')}）</>} — {ai.review.reason}
        </p>
      ) : ai.error ? (
        <p>AIの確認に失敗したため、安全側に倒して保留しました。</p>
      ) : (
        <p className="text-slate-500">ルールで拒否されたため、AIの確認は行っていません。</p>
      )}
      {ai.model && <p className="mt-1 text-xs text-slate-500">モデル {ai.model} ・ {ai.latencyMs}ms</p>}
    </div>
  );
}

type Usage = { date?: string; station?: string; minutes?: number };
const cell = (v: unknown) =>
  Array.isArray(v) ? (v as Usage[]).map((u) => `${u.date} ${u.station} ${u.minutes}分`).join(' / ') : String(v);

export function RowsTable({ rows }: { rows: Record<string, unknown>[] | null }) {
  if (!rows) return null;
  if (!rows.length) return <p className="text-sm text-slate-500">該当するデータはありません。</p>;
  const cols = Object.keys(rows[0]!);
  return (
    <div className="max-h-96 overflow-auto rounded border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-100">
          <tr>{cols.map((c) => <th key={c} className="px-2 py-1 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {cols.map((c) => <td key={c} className="px-2 py-1 align-top">{cell(r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultCard({ record, rows }: { record: RequestRecord; rows: Record<string, unknown>[] | null }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <OutcomeBadge outcome={record.finalOutcome} />
        <span className="text-sm text-slate-600">{STATUS_JA[record.status]}</span>
        {record.canaryAlert && <span className="rounded bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">カナリア警報</span>}
        <a href={`/requests/${record.id}`} className="ml-auto text-sm text-indigo-700 underline underline-offset-2">詳細を見る</a>
      </div>
      <p className="text-sm">
        <span className="text-slate-500">依頼者：</span>{record.input.requester.name}（{record.input.requester.kind}）
        <span className="ml-3 text-slate-500">項目：</span>{record.input.fields.join(', ')}
        <span className="ml-3 text-slate-500">件数：</span>{record.input.rowCount}
      </p>
      <p className="text-sm"><span className="text-slate-500">目的：</span>{record.input.purpose}</p>
      <Hits record={record} />
      <AiOpinion record={record} />
      {record.ownerDecision && (
        <p className="text-sm">
          データオーナー（{record.ownerDecision.byEmail}）が{record.ownerDecision.decision === 'approve' ? '承認' : '拒否'}しました。
          {record.ownerDecision.note && <>メモ：{record.ownerDecision.note}</>}
        </p>
      )}
      <RowsTable rows={rows} />
      <p className="text-xs text-slate-400">ポリシー {record.policyHash.slice(0, 12)}</p>
    </section>
  );
}

const RED_ACTIONS = new Set(['canary.alert', 'owner.rejected_unauthorized']);

export function AuditTable({ events }: { events: AuditEvent[] }) {
  if (!events.length) return <p className="text-sm text-slate-500">記録はまだありません。</p>;
  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-100">
          <tr>{['日時', '主体', 'アクション', '結果', 'ルール', 'ポリシー', 'モデル / 遅延', '詳細'].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className={`border-t border-slate-100 align-top ${RED_ACTIONS.has(e.action) ? 'bg-rose-50' : ''}`}>
              <td className="whitespace-nowrap px-2 py-1 tabular-nums">{fmt(e.ts)}</td>
              <td className="px-2 py-1">{e.actor}</td>
              <td className="px-2 py-1"><code>{e.action}</code></td>
              <td className="px-2 py-1">{e.outcome ? <OutcomeBadge outcome={e.outcome} /> : '—'}</td>
              <td className="px-2 py-1">{e.ruleIds.join(', ') || '—'}</td>
              <td className="px-2 py-1"><code>{e.policyHash.slice(0, 8)}</code></td>
              <td className="whitespace-nowrap px-2 py-1">{e.model ? `${e.model} / ${e.latencyMs}ms` : '—'}</td>
              <td className="px-2 py-1">
                <a href={`/requests/${e.requestId}`} className="text-indigo-700 underline underline-offset-2">{e.requestId.slice(0, 8)}</a> {e.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
