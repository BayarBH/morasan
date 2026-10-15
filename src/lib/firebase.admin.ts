import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { loadPolicy } from '@/core/policy';
import { env } from './env.server';

/** firebase-admin with Application Default Credentials. Server only. */
const adminApp = () => getApps()[0] ?? initializeApp({ projectId: env().GOOGLE_CLOUD_PROJECT });

export const db = () => getFirestore(adminApp(), env().FIRESTORE_DATABASE_ID);

export type Role = 'owner' | 'staff';
export type RequestUser = { uid: string; email: string; role: Role };

/** Verifies `Authorization: Bearer <Firebase ID token>`; null when missing/invalid. Role derived from email vs policy. */
export async function verifyRequestUser(req: Request): Promise<RequestUser | null> {
  const h = req.headers.get('authorization');
  const token = h?.startsWith('Bearer ') ? h.slice(7) : undefined;
  if (!token) return null;
  try {
    const d = await getAuth(adminApp()).verifyIdToken(token);
    if (!d.email) return null;
    const email = d.email.toLowerCase();
    return { uid: d.uid, email, role: email === loadPolicy(process.env).dataOwnerEmail.toLowerCase() ? 'owner' : 'staff' };
  } catch {
    return null;
  }
}
