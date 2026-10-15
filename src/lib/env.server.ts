import { z } from 'zod';

const Env = z.object({
  GOOGLE_CLOUD_PROJECT: z.string().min(1),
  GOOGLE_CLOUD_LOCATION: z.string().default('global'),
  MODEL_FAST: z.string().min(1).refine((m) => !m.includes('2.5'), 'Gemini 2.5 is not allowed'),
  FIRESTORE_DATABASE_ID: z.string().default('morasan'),
});
export type Env = z.infer<typeof Env>;

let cached: Env | undefined;
/** Parsed on first use so `next build` works without env. */
export const env = (): Env => (cached ??= Env.parse(process.env));
