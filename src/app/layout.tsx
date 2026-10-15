import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'モラサン｜個人データの出口ゲートウェイ（架空のデモ）',
  description: 'AIは止められるが、出せない。個人データの出口に立つゲートウェイ。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 text-slate-800">
        <div role="note" className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900">
          架空のデモです。実在の企業・人物とは関係ありません。
        </div>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
