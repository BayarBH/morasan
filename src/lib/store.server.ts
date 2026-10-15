import { randomUUID } from 'node:crypto';
import { AuditEvent, RequestRecord } from '@/core/schemas';
import { db } from './firebase.admin';

// Firestore rejects `undefined`: round-trip through JSON. Records hold member IDs only, never row contents.
const plain = <T,>(v: T) => JSON.parse(JSON.stringify(v));

const requests = () => db().collection('requests');
const audit = () => db().collection('audit');

export const saveRequest = (r: RequestRecord) => requests().doc(r.id).set(plain(r));

export async function getRequest(id: string): Promise<RequestRecord | null> {
  const s = await requests().doc(id).get();
  return s.exists ? RequestRecord.parse(s.data()) : null;
}

export async function listRequests(limit = 100): Promise<RequestRecord[]> {
  const s = await requests().orderBy('createdAt', 'desc').limit(limit).get();
  return s.docs.map((d) => RequestRecord.parse(d.data()));
}

/** Read-modify-write in a transaction so two owner clicks can't both decide. */
export async function updateRequest(id: string, fn: (r: RequestRecord) => RequestRecord): Promise<RequestRecord | null> {
  return db().runTransaction(async (tx) => {
    const ref = requests().doc(id);
    const s = await tx.get(ref);
    if (!s.exists) return null;
    const next = fn(RequestRecord.parse(s.data()));
    tx.set(ref, plain(next));
    return next;
  });
}

export type AuditInput = Omit<AuditEvent, 'id' | 'ts' | 'model' | 'latencyMs' | 'outcome' | 'ruleIds'> &
  Partial<Pick<AuditEvent, 'model' | 'latencyMs' | 'outcome' | 'ruleIds'>>;

/** Black box writer. `detail` must never contain raw personal data — counts, ids of rules, field names only. */
export async function writeAudit(e: AuditInput): Promise<AuditEvent> {
  const ev = AuditEvent.parse({ outcome: null, ruleIds: [], model: null, latencyMs: null, ...e, id: randomUUID(), ts: new Date().toISOString() });
  console.log(JSON.stringify({ severity: 'INFO', message: `audit ${ev.action}`, audit: ev }));
  await audit().doc(ev.id).set(plain(ev));
  return ev;
}

export async function listAudit(opts: { requestId?: string; limit?: number } = {}): Promise<AuditEvent[]> {
  // ponytail: requestId filter done in memory to avoid a composite index; fine for a demo-sized black box.
  const s = await audit().orderBy('ts', 'desc').limit(opts.limit ?? 500).get();
  const all = s.docs.map((d) => AuditEvent.parse(d.data()));
  return opts.requestId ? all.filter((e) => e.requestId === opts.requestId).reverse() : all;
}
