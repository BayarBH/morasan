import { NextResponse } from 'next/server';
import { verifyRequestUser, type RequestUser } from './firebase.admin';

/** Wraps a route handler: requires a valid Firebase ID token; errors → JSON. */
export const authed =
  <C,>(fn: (req: Request, user: RequestUser, ctx: C) => Promise<Response>) =>
  async (req: Request, ctx: C) => {
    const user = await verifyRequestUser(req);
    if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
    try {
      return await fn(req, user, ctx);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: 'サーバーでエラーが発生しました。' }, { status: 500 });
    }
  };
