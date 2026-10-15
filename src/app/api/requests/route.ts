import { NextResponse } from 'next/server';
import { authed } from '@/lib/route.server';
import { listRequests } from '@/lib/store.server';

export const dynamic = 'force-dynamic';
export const GET = authed(async () => NextResponse.json({ requests: await listRequests() }));
