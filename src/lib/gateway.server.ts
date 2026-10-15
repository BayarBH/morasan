import { randomUUID } from 'node:crypto';
import {
  applyMask, combine, evaluateRules, loadPolicy, ownerDecide, policyHash, sanitizePurpose, selectRows,
  type DataRequestInput, type RequestRecord, type RequestStatus,
} from '@/core';
import type { z } from 'zod';
import { MEMBERS, getMember } from '@/data/members';
import { reviewPurpose } from './gemini.server';
import { getRequest, saveRequest, updateRequest, writeAudit } from './store.server';
import type { RequestUser } from './firebase.admin';

type Status = z.infer<typeof RequestStatus>;
const STATUS: Record<RequestRecord['finalOutcome'], Status> = { release: 'released', mask: 'masked', hold: 'held', deny: 'denied' };
const RELEASED: Status[] = ['released', 'masked', 'approved'];

export const policy = () => loadPolicy(process.env);
const actorOf = (i: DataRequestInput) => (i.requester.kind === 'agent' ? `agent:${i.requester.id}` : `staff:${i.requester.name}`);

/** Rows are never stored: recomputed from member IDs, only when the record is in a released state. */
export function releasedRows(r: RequestRecord): Record<string, unknown>[] | null {
  if (!RELEASED.includes(r.status)) return null;
  const rows = r.rules.selectedMemberIds.map(getMember).filter((m) => !!m);
  return applyMask(rows, r.input.fields, r.maskFields);
}

/** DESIGN.md flow steps 1–8. */
export async function handleRequest(raw: DataRequestInput): Promise<RequestRecord> {
  const p = policy();
  const ph = policyHash(p);
  const id = randomUUID();
  const input: DataRequestInput = { ...raw, purpose: sanitizePurpose(raw.purpose) };
  const actor = actorOf(input);

  await writeAudit({ requestId: id, actor, action: 'request.received', policyHash: ph,
    detail: `fields=[${input.fields.join(',')}] rowCount=${input.rowCount} scope=${input.scope}${input.memberIds ? ` memberIds=${input.memberIds.length}件` : ''}` });

  const selected = selectRows(MEMBERS, input);
  const rules = evaluateRules(p, input, selected);
  await writeAudit({ requestId: id, actor: 'gateway', action: 'rules.evaluated', outcome: rules.outcome, policyHash: ph,
    ruleIds: rules.hits.map((h) => h.ruleId), detail: `selected=${selected.length}件` });
  if (rules.canaryTouched) {
    await writeAudit({ requestId: id, actor: 'gateway', action: 'canary.alert', outcome: 'hold', policyHash: ph, ruleIds: ['R-CANARY-ALERT'],
      detail: `カナリア（おとり）レコードへのアクセスを検知しました。依頼者=${actor}` });
  }

  let ai: RequestRecord['ai'] = { review: null, model: null, latencyMs: null, error: null };
  if (rules.outcome !== 'deny') {
    const r = await reviewPurpose(input, p);
    ai = r;
    await writeAudit({ requestId: id, actor: `gemini:${r.model}`, action: r.review ? 'ai.reviewed' : 'ai.failsafe',
      outcome: r.review ? (r.review.verdict === 'ok' ? null : r.review.verdict) : 'hold',
      ruleIds: r.review ? [] : ['AI-FAILSAFE-HOLD'], policyHash: ph, model: r.model, latencyMs: r.latencyMs,
      detail: r.review ? `verdict=${r.review.verdict}${r.review.maskFields.length ? ` mask=[${r.review.maskFields.join(',')}]` : ''}` : `error: ${r.error}` });
  }

  const c = combine(rules, ai.review, rules.outcome !== 'deny' && !ai.review, p);
  const record: RequestRecord = {
    id, createdAt: new Date().toISOString(), input, rules, ai,
    finalOutcome: c.outcome, status: STATUS[c.outcome], hits: c.hits, maskFields: c.maskFields,
    canaryAlert: rules.canaryTouched, ownerDecision: null, policyHash: ph,
  };
  await saveRequest(record);
  await writeAudit({ requestId: id, actor: 'gateway', action: 'decision.final', outcome: c.outcome, policyHash: ph,
    ruleIds: c.hits.map((h) => h.ruleId), detail: `status=${record.status}` });
  if (RELEASED.includes(record.status)) await auditRelease(record, ph);
  return record;
}

const auditRelease = (r: RequestRecord, ph: string) =>
  writeAudit({ requestId: r.id, actor: 'gateway', action: 'data.released', outcome: r.finalOutcome, policyHash: ph,
    ruleIds: r.hits.map((h) => h.ruleId).slice(-1),
    detail: `${r.rules.selectedMemberIds.length}件 fields=[${r.input.fields.join(',')}]${r.maskFields.length ? ` masked=[${r.maskFields.join(',')}]` : ''}` });

export type DecideResult = { ok: true; record: RequestRecord } | { ok: false; status: number; error: string };

/** Identity-bound owner decision. Every refusal is audited. */
export async function decide(user: RequestUser, id: string, decision: 'approve' | 'deny', note: string): Promise<DecideResult> {
  const p = policy();
  const ph = policyHash(p);
  const reject = async (status: number, error: string): Promise<DecideResult> => {
    await writeAudit({ requestId: id, actor: `${user.role}:${user.email}`, action: 'owner.rejected_unauthorized', policyHash: ph,
      detail: `decision=${decision} を拒否：${error}` });
    return { ok: false, status, error };
  };
  if (user.role !== 'owner') return reject(403, 'データオーナーのみが判断できます。');
  if (!(await getRequest(id))) return { ok: false, status: 404, error: 'リクエストが見つかりません。' };

  let err: string | null = null;
  const rec = await updateRequest(id, (r) => {
    const res = ownerDecide(r, decision, user.email, p);
    if (!res.ok) { err = res.error; return r; }
    err = null;
    return { ...r, status: res.status, finalOutcome: res.outcome, hits: [...r.hits, res.hit],
      ownerDecision: { by: user.uid, byEmail: user.email, at: new Date().toISOString(), decision, note: note.slice(0, 500) } };
  });
  if (!rec) return { ok: false, status: 404, error: 'リクエストが見つかりません。' };
  if (err) return reject(409, err);

  await writeAudit({ requestId: id, actor: `owner:${user.email}`, action: decision === 'approve' ? 'owner.approve' : 'owner.deny',
    outcome: rec.finalOutcome, policyHash: ph, ruleIds: [decision === 'approve' ? 'OWNER-APPROVE' : 'OWNER-DENY'],
    detail: note ? `メモあり（${note.length}文字）` : 'メモなし' });
  if (rec.status === 'approved') await auditRelease(rec, ph);
  return { ok: true, record: rec };
}
