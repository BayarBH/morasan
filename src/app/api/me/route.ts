import { NextResponse } from 'next/server';
import { authed } from '@/lib/route.server';

export const GET = authed(async (_req, user) => NextResponse.json(user));
