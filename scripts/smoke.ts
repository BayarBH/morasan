// Smoke test against a running deployment: signs in both demo users, runs every preset as staff,
// then has the owner approve the staff hold (p5). Tolerant: prints everything, exits 1 only on hard failures.
// Usage: npx tsx --env-file=.env.local scripts/smoke.ts [baseUrl]   (default http://localhost:3000)
import { PRESETS } from '../src/lib/presets';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const env = process.env;

async function signIn(email: string, password = ''): Promise<string> {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!r.ok) throw new Error(`sign-in ${email}: ${r.status} ${await r.text()}`);
  return ((await r.json()) as { idToken: string }).idToken;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function post(path: string, token: string, body: unknown): Promise<{ status: number; json: any }> {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((e) => e as Error);
  if (r instanceof Error) return { status: 599, json: { error: String(r.cause ?? r) } };
  const text = await r.text();
  try { return { status: r.status, json: JSON.parse(text) }; } catch { return { status: r.status, json: { raw: text.slice(0, 200) } }; }
}

const staff = await signIn('staff@morasan.demo', env.SEED_PASSWORD_STAFF);
const owner = await signIn('owner@morasan.demo', env.SEED_PASSWORD_OWNER);
console.log(`signed in both users; base=${base}`);

let failed = false;
const ids: Record<string, string> = {};
for (const p of PRESETS) {
  const { status, json } = await post('/api/gateway/request', staff, { presetId: p.id });
  const rec = json.record;
  if (rec) ids[p.id] = rec.id;
  failed ||= status >= 500;
  console.log(`${p.id} ${p.title}\n   expect: ${p.expect}\n   got: HTTP ${status} status=${rec?.status} outcome=${rec?.finalOutcome} canary=${rec?.canaryAlert} rows=${json.rows?.length ?? '-'} hits=${(rec?.hits ?? []).map((h: { ruleId?: string }) => h.ruleId).join(',')}${rec ? '' : ` ${JSON.stringify(json).slice(0, 200)}`}`);
}

if (ids.p5) {
  const self = await post('/api/owner/decide', staff, { requestId: ids.p5, decision: 'approve' });
  console.log(`staff tries to approve p5 (expect refusal): HTTP ${self.status}`);
  const r = await post('/api/owner/decide', owner, { requestId: ids.p5, decision: 'approve', note: 'smoke' });
  console.log(`owner approves p5: HTTP ${r.status} status=${r.json.record?.status} rows=${r.json.rows?.length ?? '-'}`);
  failed ||= r.status >= 500;
}
process.exit(failed ? 1 : 0);
