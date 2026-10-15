import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DataRequestInput } from '@/core/schemas';
import { authed } from '@/lib/route.server';
import { handleRequest, releasedRows } from '@/lib/gateway.server';
import { PRESETS } from '@/lib/presets';

// Either a preset id, or a custom request (always submitted as the logged-in staff member).
const Body = z.union([
  z.object({ presetId: z.string() }),
  z.object({ custom: DataRequestInput.omit({ requester: true }) }),
]);

export const POST = authed(async (req, user) => {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: '入力内容が正しくありません。', issues: body.error.issues }, { status: 400 });
  const self = { kind: 'staff' as const, id: user.uid, name: user.email };
  let input: DataRequestInput;
  if ('presetId' in body.data) {
    const preset = PRESETS.find((p) => p.id === (body.data as { presetId: string }).presetId);
    if (!preset) return NextResponse.json({ error: 'プリセットが見つかりません。' }, { status: 404 });
    // Staff presets run as the caller; agent presets keep their fixed agent identity.
    input = DataRequestInput.parse({ ...preset.input, requester: preset.input.requester.kind === 'staff' ? self : preset.input.requester });
  } else {
    input = { ...body.data.custom, requester: self };
  }
  const record = await handleRequest(input);
  return NextResponse.json({ record, rows: releasedRows(record) });
});
