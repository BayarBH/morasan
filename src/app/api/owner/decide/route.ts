import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authed } from '@/lib/route.server';
import { decide, releasedRows } from '@/lib/gateway.server';

const Body = z.object({ requestId: z.string().min(1), decision: z.enum(['approve', 'deny']), note: z.string().max(500).default('') });

export const POST = authed(async (req, user) => {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: '入力内容が正しくありません。' }, { status: 400 });
  const r = await decide(user, body.data.requestId, body.data.decision, body.data.note);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ record: r.record, rows: releasedRows(r.record) });
});
