// Create-or-update the two demo accounts in Firebase Auth (ADC), then verify password sign-in via REST.
// Usage: npm run seed:users
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const env = process.env;
const need = (k: string) => env[k] || (() => { throw new Error(`${k} is required in .env.local`); })();
const auth = getAuth(initializeApp({ projectId: need('GOOGLE_CLOUD_PROJECT') }));
const apiKey = need('NEXT_PUBLIC_FIREBASE_API_KEY');

const seeds = [
  { email: 'staff@morasan.demo', displayName: '窓口スタッフ', password: need('SEED_PASSWORD_STAFF') },
  { email: 'owner@morasan.demo', displayName: 'データオーナー', password: need('SEED_PASSWORD_OWNER') },
];

const rows = [];
let failed = false;
for (const s of seeds) {
  if (s.password.length < 10) throw new Error(`password for ${s.email} must be >= 10 chars`);
  let uid: string;
  let action: string;
  try {
    uid = (await auth.getUserByEmail(s.email)).uid;
    await auth.updateUser(uid, { password: s.password, displayName: s.displayName, emailVerified: true, disabled: false });
    action = 'updated';
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
    uid = (await auth.createUser({ email: s.email, password: s.password, displayName: s.displayName, emailVerified: true })).uid;
    action = 'created';
  }
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: s.email, password: s.password, returnSecureToken: true }),
  });
  const login = res.ok ? 'OK' : `FAIL ${res.status} ${(await res.text()).slice(0, 120)}`;
  failed ||= !res.ok;
  rows.push({ email: s.email, uid, displayName: s.displayName, action, login });
}
console.table(rows);
process.exit(failed ? 1 : 0);
