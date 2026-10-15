import { OUTCOMES } from './schemas';
import type { AiReview, Field, Outcome, Policy, RequestRecord, RuleEvaluation, RuleHit } from './schemas';

export const outcomeRank = (o: Outcome): number => OUTCOMES.indexOf(o);
export const maxOutcome = (a: Outcome, b: Outcome): Outcome => (outcomeRank(a) >= outcomeRank(b) ? a : b);

export type Combined = { outcome: Outcome; hits: RuleHit[]; maskFields: Field[] };

/** Final outcome = max(rules, AI). The AI can only tighten; it has no way to release. If rules deny, the AI is irrelevant. */
export function combine(rules: RuleEvaluation, ai: AiReview | null, aiFailed: boolean, policy?: Policy): Combined {
  const base: Combined = { outcome: rules.outcome, hits: [...rules.hits], maskFields: [...rules.maskFields] };
  if (rules.outcome === 'deny') return base;

  let aiHit: RuleHit | null = null;
  if (aiFailed || !ai) {
    aiHit = { ruleId: 'AI-FAILSAFE-HOLD', outcome: 'hold', maskFields: [],
      reason: 'AIによる目的確認ができなかったため、安全側に倒して保留します。' };
  } else if (ai.verdict === 'hold' || (ai.verdict === 'mask' && ai.maskFields.length === 0)) {
    // mask without fields is meaningless → escalate rather than silently release
    aiHit = { ruleId: 'AI-PURPOSE-HOLD', outcome: 'hold', maskFields: [], reason: `AIの所見：${ai.reason}` };
  } else if (ai.verdict === 'mask' && policy && ai.maskFields.some((f) => policy.sensitiveFields.includes(f))) {
    // AI found a sensitive field the purpose doesn't need → a human data owner decides (tighten, never loosen)
    aiHit = { ruleId: 'AI-PURPOSE-HOLD', outcome: 'hold', maskFields: [...new Set(ai.maskFields)],
      reason: `AIの所見：目的に不要な機微項目が含まれています。データオーナーに判断を委ねます。${ai.reason}` };
  } else if (ai.verdict === 'mask') {
    aiHit = { ruleId: 'AI-PURPOSE-MASK', outcome: 'mask', maskFields: [...new Set(ai.maskFields)], reason: `AIの所見：${ai.reason}` };
  }
  if (!aiHit) return base;
  return {
    outcome: maxOutcome(base.outcome, aiHit.outcome),
    hits: [...base.hits, aiHit],
    maskFields: [...new Set([...base.maskFields, ...aiHit.maskFields])],
  };
}

const norm = (s: string) => s.trim().toLowerCase();

export type OwnerResult =
  | { ok: true; status: 'approved' | 'owner_denied'; outcome: Outcome; hit: RuleHit }
  | { ok: false; error: string };

/** Only the pre-chosen data owner may decide, only on held requests, never on their own request. */
export function ownerDecide(
  record: Pick<RequestRecord, 'status' | 'finalOutcome' | 'maskFields' | 'input'>,
  decision: 'approve' | 'deny',
  actorEmail: string,
  policy: Policy,
): OwnerResult {
  if (record.status !== 'held' || record.finalOutcome !== 'hold') return { ok: false, error: '保留中のリクエストのみ判断できます。' };
  if (!actorEmail || norm(actorEmail) !== norm(policy.dataOwnerEmail)) return { ok: false, error: 'データオーナーのみが判断できます。' };
  const r = record.input.requester;
  if (norm(r.id) === norm(actorEmail) || norm(r.name) === norm(actorEmail)) {
    return { ok: false, error: '自分が依頼したリクエストは承認できません。' };
  }
  if (decision === 'deny') {
    return { ok: true, status: 'owner_denied', outcome: 'deny',
      hit: { ruleId: 'OWNER-DENY', outcome: 'deny', maskFields: [], reason: 'データオーナーが拒否しました。' } };
  }
  const outcome: Outcome = record.maskFields.length > 0 ? 'mask' : 'release';
  return { ok: true, status: 'approved', outcome,
    hit: { ruleId: 'OWNER-APPROVE', outcome, maskFields: [...record.maskFields],
      reason: outcome === 'mask' ? 'データオーナーが承認しました（伏せ字付きで提供）。' : 'データオーナーが承認しました。' } };
}
