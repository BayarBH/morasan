'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { clientAuth } from './firebase.client';

/** Signed-in Firebase user; redirects to /login when signed out. */
export function useUser(): User | null {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(
    () =>
      onAuthStateChanged(clientAuth(), (u) => {
        if (!u) router.replace('/login');
        setUser(u);
      }),
    [router],
  );
  return user;
}

/** fetch with the current user's ID token; throws with the server's error message on non-2xx. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const user = clientAuth().currentUser;
  if (!user) throw new Error('ログインしてください。');
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: { authorization: `Bearer ${await user.getIdToken()}`, 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}
