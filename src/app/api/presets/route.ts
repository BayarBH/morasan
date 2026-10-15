import { NextResponse } from 'next/server';
import { authed } from '@/lib/route.server';
import { PRESETS } from '@/lib/presets';

export const GET = authed(async () => NextResponse.json({ presets: PRESETS }));
