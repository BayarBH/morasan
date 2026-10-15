import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { AiReview, type DataRequestInput, type Policy } from '@/core/schemas';
import { buildPurposeReviewPrompt } from '@/core/guard';
import { env } from './env.server';

const TIMEOUT_MS = 15_000;
let client: GoogleGenAI | undefined;
const genai = () =>
  (client ??= new GoogleGenAI({ vertexai: true, project: env().GOOGLE_CLOUD_PROJECT, location: env().GOOGLE_CLOUD_LOCATION }));

export type AiResult = { review: AiReview | null; model: string; latencyMs: number; error: string | null };

const retryable = (e: unknown) => {
  const s = String((e as { status?: number })?.status ?? '') + ' ' + String((e as Error)?.message ?? e) + ' ' + String((e as Error)?.name ?? '');
  return /429|RESOURCE_EXHAUSTED|timeout|timed out|Abort/i.test(s);
};

/** Purpose review. Gemini may only answer ok|mask|hold. Any failure → review null + error (caller fail-safes to hold). */
export async function reviewPurpose(input: DataRequestInput, policy: Policy): Promise<AiResult> {
  const model = env().MODEL_FAST;
  const { system, user } = buildPurposeReviewPrompt(input, policy);
  const t0 = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await genai().models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: user }] }],
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(AiReview, { io: 'input' }),
          temperature: 0,
          maxOutputTokens: 1024,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      const review = AiReview.parse(JSON.parse(r.text ?? ''));
      return { review, model, latencyMs: Date.now() - t0, error: null };
    } catch (e) {
      if (attempt === 0 && retryable(e)) continue;
      return { review: null, model, latencyMs: Date.now() - t0, error: String((e as Error)?.message ?? e).slice(0, 200) };
    }
  }
}
