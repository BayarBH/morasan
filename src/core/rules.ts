import type { DataRequestInput, Field, Member, Policy, RuleEvaluation, RuleHit } from './schemas';
import { maxOutcome } from './combine';
import { policyHash } from './policy';

/** Number of rows the request asks for: explicit memberIds count, else rowCount. */
export function requestedRows(input: Pick<DataRequestInput, 'rowCount' | 'memberIds'>): number {
  return input.memberIds ? input.memberIds.length : input.rowCount;
}

/** Pure, deterministic. Same policy + input + selected rows → same result. */
export function evaluateRules(policy: Policy, input: DataRequestInput, selected: readonly Member[]): RuleEvaluation {
  const hits: RuleHit[] = [];
  const n = requestedRows(input);
  const fields = [...new Set(input.fields)];

  if (n > policy.maxRowsAuto) {
    hits.push({ ruleId: 'R-BULK-HOLD', outcome: 'hold', maskFields: [],
      reason: `要求件数 ${n} 件が自動提供の上限 ${policy.maxRowsAuto} 件を超えています。データオーナーの承認が必要です。` });
  }
  const sensitive = fields.filter((f) => policy.sensitiveFields.includes(f));
  if (sensitive.length > 0 && n > policy.sensitiveMaxRows) {
    hits.push({ ruleId: 'R-SENSITIVE-BULK', outcome: 'deny', maskFields: [],
      reason: `機微項目（${sensitive.join(', ')}）は ${policy.sensitiveMaxRows} 件までしか提供できません（要求 ${n} 件）。` });
  }
  const withdrawn = selected.filter((m) => m.status === 'withdrawn').length;
  if (withdrawn > 0) {
    hits.push({ ruleId: 'R-WITHDRAWN-DENY', outcome: 'deny', maskFields: [],
      reason: `退会済み会員 ${withdrawn} 件が含まれています。退会した会員のデータは提供しません。` });
  }
  const canaries = selected.filter((m) => m.canary).length;
  if (canaries > 0) {
    hits.push({ ruleId: 'R-CANARY-ALERT', outcome: 'hold', maskFields: [],
      reason: `監視用のカナリア記録 ${canaries} 件に触れました。不審なアクセスとして保留し、警報を出します。` });
  }
  const masked: Field[] = fields.filter((f) => policy.alwaysMask.includes(f));
  if (input.requester.kind === 'agent' && masked.length > 0) {
    hits.push({ ruleId: 'R-MASK-DEFAULT', outcome: 'mask', maskFields: masked,
      reason: `AIエージェントには ${masked.join(', ')} を伏せ字で提供します。` });
  }
  if (hits.length === 0) {
    hits.push({ ruleId: 'R-BASE-ALLOW', outcome: 'release', maskFields: [], reason: 'ルール上の制限に該当しません。' });
  }

  return {
    outcome: hits.reduce((o, h) => maxOutcome(o, h.outcome), 'release' as RuleEvaluation['outcome']),
    hits,
    maskFields: [...new Set(hits.flatMap((h) => h.maskFields))],
    canaryTouched: canaries > 0,
    selectedMemberIds: selected.map((m) => m.memberId),
    policyHash: policyHash(policy),
  };
}
