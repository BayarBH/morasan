import { NextResponse } from 'next/server';
import { authed } from '@/lib/route.server';
import { getRequest, listAudit } from '@/lib/store.server';
import { releasedRows } from '@/lib/gateway.server';

export const dynamic = 'force-dynamic';
export const GET = authed<{ params: Promise<{ id: string }> }>(async (_req, _user, { params }) => {
  const { id } = await params;
  const record = await getRequest(id);
  if (!record) return NextResponse.json({ error: 'リクエストが見つかりません。' }, { status: 404 });
  return NextResponse.json({ record, rows: releasedRows(record), events: await listAudit({ requestId: id }) });
});
