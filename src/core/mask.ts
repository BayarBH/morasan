import type { Field, Member } from './schemas';

export const MASK = '＊＊＊';
export const LICENSE_IMAGE_PLACEHOLDER = '［免許証画像（デモ用プレースホルダ）］';

/** Only requested fields; masked fields → ＊＊＊; licenseImage is never rendered as real data. */
export function applyMask(rows: readonly Member[], fields: readonly Field[], maskFields: readonly Field[]): Record<string, unknown>[] {
  const mask = new Set(maskFields);
  return rows.map((m) =>
    Object.fromEntries([...new Set(fields)].map((f) => [
      f,
      mask.has(f) ? MASK : f === 'licenseImage' ? LICENSE_IMAGE_PLACEHOLDER : m[f],
    ])),
  );
}
