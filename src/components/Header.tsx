'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase.client';

const NAV = [
  { href: '/', label: 'コンソール' },
  { href: '/owner', label: 'データオーナー受信箱' },
  { href: '/audit', label: 'ブラックボックス' },
];

export function Header() {
  const path = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(clientAuth(), (u) => setEmail(u?.email ?? null)), []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-wide">
          モラサン<span className="ml-2 text-xs font-normal text-slate-500">ミライカーシェア（架空）</span>
        </Link>
        {email && (
          <>
            <nav className="flex gap-4 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}
                  className={path === n.href ? 'font-semibold text-indigo-700' : 'text-slate-600 hover:text-slate-900'}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
              <span>{email}</span>
              <button onClick={() => signOut(clientAuth()).then(() => router.replace('/login'))}
                className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
                ログアウト
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
