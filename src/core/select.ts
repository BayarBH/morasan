import type { DataRequestInput, Member } from './schemas';

/** memberIds (if given) override scope; otherwise the first `rowCount` members in scope, ordered by memberId. */
export function selectRows(members: readonly Member[], input: Pick<DataRequestInput, 'rowCount' | 'scope' | 'memberIds'>): Member[] {
  if (input.memberIds) {
    const byId = new Map(members.map((m) => [m.memberId, m]));
    return [...new Set(input.memberIds)].map((id) => byId.get(id)).filter((m): m is Member => !!m);
  }
  const scope = input.scope ?? 'active';
  return [...members]
    .filter((m) => scope === 'all' || m.status === 'active')
    .sort((a, b) => a.memberId.localeCompare(b.memberId))
    .slice(0, input.rowCount);
}
