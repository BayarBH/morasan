import { createHash } from 'node:crypto';
import type { Policy } from './schemas';

export const DEFAULT_OWNER_EMAIL = 'owner@morasan.demo';

export function makePolicy(dataOwnerEmail: string = DEFAULT_OWNER_EMAIL): Policy {
  return {
    version: '2026-10-15',
    maxRowsAuto: 20,
    sensitiveFields: ['address', 'licenseImage', 'licenseNumber'],
    sensitiveMaxRows: 1,
    alwaysMask: ['paymentLast4'],
    dataOwnerEmail,
  };
}

export const DEFAULT_POLICY: Policy = makePolicy();

/** Policy with dataOwnerEmail taken from DATA_OWNER_EMAIL (falls back to the default owner). */
export function loadPolicy(env: Record<string, string | undefined> = process.env): Policy {
  const email = env.DATA_OWNER_EMAIL?.trim();
  return makePolicy(email || DEFAULT_OWNER_EMAIL);
}

/** JSON with object keys sorted recursively, so the hash does not depend on key order. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

export function policyHash(p: Policy): string {
  return createHash('sha256').update(canonicalJson(p)).digest('hex');
}
