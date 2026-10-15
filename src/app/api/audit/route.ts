import { NextResponse } from 'next/server';
import { authed } from '@/lib/route.server';
import { listAudit } from '@/lib/store.server';

export const dynamic = 'force-dynamic';
export const GET = authed(async (req) => {
  const requestId = new URL(req.url).searchParams.get('requestId') ?? undefined;
  return NextResponse.json({ events: await listAudit({ requestId }) });
});
