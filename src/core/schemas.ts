// Shared contract for モラサン. Pure TS, no I/O. Every agent/module builds against these types.
// Principle: AI can hold, never release. Outcomes are totally ordered; the AI may only move UP the order.
import { z } from 'zod';

// ── Fictional member DB (car-sharing company 「ミライカーシェア（架空）」) ───────────
export const FIELDS = [
  'memberId', 'name', 'email', 'phone', 'address', 'birthDate',
  'licenseNumber', 'licenseImage', 'paymentLast4', 'usageHistory', 'status',
] as const;
export const Field = z.enum(FIELDS);
export type Field = z.infer<typeof Field>;

export const MemberStatus = z.enum(['active', 'withdrawn']);
export const Member = z.object({
  memberId: z.string(),          // e.g. "M-000123"
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  birthDate: z.string(),         // YYYY-MM-DD
  licenseNumber: z.string(),
  licenseImage: z.string(),      // placeholder token, e.g. "license-img://M-000123"
  paymentLast4: z.string(),
  usageHistory: z.array(z.object({ date: z.string(), station: z.string(), minutes: z.number() })),
  status: MemberStatus,
  withdrawnAt: z.string().nullable(),
  canary: z.boolean(),           // honeytoken record; touching it = alert
});
export type Member = z.infer<typeof Member>;

// ── Request into the gateway ───────────────────────────────────────────────
export const RequesterKind = z.enum(['agent', 'staff']);
export const Requester = z.object({
  kind: RequesterKind,
  id: z.string(),                // agent id (e.g. "support-bot") or Firebase uid
  name: z.string(),              // display name
});
export type Requester = z.infer<typeof Requester>;

export const DataRequestInput = z.object({
  requester: Requester,
  purpose: z.string().min(1).max(500), // UNTRUSTED free text — data, never instructions
  fields: z.array(Field).min(1),
  rowCount: z.number().int().min(1).max(100000),
  // 'active' = active members only (default); 'all' = includes withdrawn members (→ R-WITHDRAWN-DENY if any hit).
  scope: z.enum(['active', 'all']).default('active'),
  // Optional explicit selection (overrides scope). Otherwise the gateway takes the first `rowCount` members in scope,
  // ordered by memberId. Canary records are interleaved in the DB (≈ every 100th row), so large dumps touch them.
  memberIds: z.array(z.string()).max(1000).optional(),
});
export type DataRequestInput = z.infer<typeof DataRequestInput>;

// ── Outcomes (monotonic order) ─────────────────────────────────────────────
// release < mask < hold < deny. hold = waiting for the pre-chosen human data owner.
export const OUTCOMES = ['release', 'mask', 'hold', 'deny'] as const;
export const Outcome = z.enum(OUTCOMES);
export type Outcome = z.infer<typeof Outcome>;

export const RuleId = z.enum([
  'R-BASE-ALLOW',        // nothing triggered
  'R-BULK-HOLD',         // rowCount > policy.maxRowsAuto → hold
  'R-SENSITIVE-BULK',    // sensitive field with rowCount > policy.sensitiveMaxRows → deny
  'R-WITHDRAWN-DENY',    // any selected row is a withdrawn member → deny
  'R-CANARY-ALERT',      // any selected row is a canary → alert + hold
  'R-MASK-DEFAULT',      // policy.alwaysMask fields present → mask
  'AI-PURPOSE-MASK',     // Gemini tightened to mask
  'AI-PURPOSE-HOLD',     // Gemini tightened to hold / escalate to data owner
  'AI-FAILSAFE-HOLD',    // Gemini error/timeout/invalid output → hold
  'OWNER-APPROVE',       // data owner approved a held request
  'OWNER-DENY',          // data owner denied a held request
]);
export type RuleId = z.infer<typeof RuleId>;

export const RuleHit = z.object({
  ruleId: RuleId,
  outcome: Outcome,
  reason: z.string(),              // Japanese, deterministic text
  maskFields: z.array(Field).default([]),
});
export type RuleHit = z.infer<typeof RuleHit>;

export const Policy = z.object({
  version: z.string(),
  maxRowsAuto: z.number().int(),              // e.g. 20
  sensitiveFields: z.array(Field),            // ['address', 'licenseImage', 'licenseNumber']
  sensitiveMaxRows: z.number().int(),         // e.g. 1
  alwaysMask: z.array(Field),                 // e.g. ['paymentLast4'] for agents
  dataOwnerEmail: z.string(),                 // pre-chosen human data owner
});
export type Policy = z.infer<typeof Policy>;

// Deterministic evaluation result (pure function of policy + request + selected rows).
export const RuleEvaluation = z.object({
  outcome: Outcome,                 // max over hits
  hits: z.array(RuleHit),
  maskFields: z.array(Field),       // union of hit maskFields
  canaryTouched: z.boolean(),
  selectedMemberIds: z.array(z.string()),
  policyHash: z.string(),           // sha256 hex of canonical policy JSON
});
export type RuleEvaluation = z.infer<typeof RuleEvaluation>;

// What Gemini is allowed to say. No "approve" exists in this schema.
export const AiReview = z.object({
  verdict: z.enum(['ok', 'mask', 'hold']),     // ok = no further tightening
  maskFields: z.array(Field).default([]),
  reason: z.string().max(400),                 // Japanese, shown as AI opinion only
});
export type AiReview = z.infer<typeof AiReview>;

// ── Stored request record (Firestore `requests`) ───────────────────────────
export const RequestStatus = z.enum(['released', 'masked', 'held', 'denied', 'approved', 'owner_denied']);
export const RequestRecord = z.object({
  id: z.string(),
  createdAt: z.string(),            // ISO
  input: DataRequestInput,
  rules: RuleEvaluation,
  ai: z.object({ review: AiReview.nullable(), model: z.string().nullable(), latencyMs: z.number().nullable(), error: z.string().nullable() }),
  finalOutcome: Outcome,            // combine(rules.outcome, ai) — never lower than rules.outcome
  status: RequestStatus,
  hits: z.array(RuleHit),           // rule hits + AI hits
  maskFields: z.array(Field),
  canaryAlert: z.boolean(),
  ownerDecision: z.object({ by: z.string(), byEmail: z.string(), at: z.string(), decision: z.enum(['approve', 'deny']), note: z.string() }).nullable(),
  policyHash: z.string(),
});
export type RequestRecord = z.infer<typeof RequestRecord>;

// ── Black box (Firestore `audit`) ──────────────────────────────────────────
export const AuditAction = z.enum([
  'request.received', 'rules.evaluated', 'ai.reviewed', 'ai.failsafe',
  'decision.final', 'canary.alert', 'owner.approve', 'owner.deny', 'owner.rejected_unauthorized',
  'data.released',
]);
export const AuditEvent = z.object({
  id: z.string(),
  ts: z.string(),
  requestId: z.string(),
  actor: z.string(),                 // "gateway", "gemini:<model>", "owner:<email>", "agent:<id>", "staff:<email>"
  action: AuditAction,
  outcome: Outcome.nullable(),
  ruleIds: z.array(RuleId),
  policyHash: z.string(),
  model: z.string().nullable(),
  latencyMs: z.number().nullable(),
  detail: z.string(),                // short Japanese/English summary, never raw personal data
});
export type AuditEvent = z.infer<typeof AuditEvent>;

// ── Function signatures implemented in src/core (see each file) ────────────
// policy.ts : DEFAULT_POLICY: Policy; policyHash(p: Policy): string  (sha256 of canonical JSON, node:crypto)
// rules.ts  : evaluateRules(policy, input, selected: Member[]): RuleEvaluation
// combine.ts: maxOutcome(a,b): Outcome; combine(rules: RuleEvaluation, ai: AiReview | null, aiFailed: boolean): { outcome, hits, maskFields }
//             ownerDecide(record: RequestRecord, decision, ownerEmail, policy): Result — only 'hold' can be approved; deny is final;
//             approval of a hold yields 'release' unless maskFields non-empty → 'mask'. Requester can never be owner.
// mask.ts   : applyMask(rows: Member[], fields: Field[], maskFields: Field[]): Record<string, unknown>[]  (only requested fields; masked → "＊＊＊")
// guard.ts  : sanitizePurpose(text): string  (strip control chars, cap length; purpose is data, not instructions)
