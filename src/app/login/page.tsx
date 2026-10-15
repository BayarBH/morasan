'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase.client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(clientAuth(), email, password);
      router.push('/');
    } catch {
      setError('メールアドレスまたはパスワードが正しくありません。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-8 max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold">ログイン</h2>
      <label className="block text-sm">
        メールアドレス
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        パスワード
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded bg-indigo-700 py-2 text-white hover:bg-indigo-800 disabled:opacity-50">
        {busy ? 'ログイン中…' : 'ログイン'}
      </button>
      <div className="space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <p>テスト用アカウント：staff@morasan.demo（窓口スタッフ）、owner@morasan.demo（データオーナー）</p>
        <p>パスワードは応募フォームの「動作確認の方法」をご覧ください。</p>
      </div>
    </form>
  );
}
