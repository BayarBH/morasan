# モラサン（漏らさん）— brief for a new session

Second entry for the Zenn × Google Cloud "Agentic AI Hackathon" vol.5. Separate repo from MATTA (`C:\Users\14042\Downloads\matta`).

## First, before any code
- Confirm in the official rules (https://zenn.dev/hackathons/google-cloud-japan-ai-hackathon-vol5) that one person may submit two entries, and the exact deadline. If two entries are not allowed, stop.
- Ask the user before creating any GCP resources (new Cloud Run service, Firestore database).

## One-liner
A data-egress gateway for AI agents and staff: every read of customer data goes through it. **AI can hold, never release.** Release only by deterministic rules or a pre-chosen human data owner.

## Minimal scope (demo-first)
- Fictional member DB (e.g. a car-sharing company) with fake records, including withdrawn members and a few canary records.
- Requests: `{requester (agent|staff), purpose, fields, rowCount}`.
- Deterministic rules (pure TS, unit-tested):
  - more than N rows → hold;
  - sensitive fields (license image, address) never in bulk;
  - withdrawn members → always denied;
  - any canary record touched → alert and hold.
- Gemini reads the stated purpose vs the requested fields. It may only tighten: hold, mask, or escalate to the data owner. It never approves.
- Data-owner inbox: approve/deny, identity-bound.
- Black box: every decision audited with ruleId + policyHash.
- Pitch: unlike MATTA (money), this governs **AI agents' access to personal data**. Motivating case: the Sept 2026 タイムズカー leak (≈6.6M accounts, incl. withdrawn members).

## Reuse from MATTA (copy patterns, not code wholesale)
- `packages/core`: zod schemas, policy hash, message guard, monotonic-safety structure.
- Audit event shape, fail-safe on LLM error, demo banner 「架空のデモです」.
- Deploy: `infra/deploy.sh` pattern.
  - Cloud Run in **asia-east1**, because asia-northeast1 hit ProjectInitFailedQuotaExceeded.
  - Same GCP project `useful-cathode-450302-f0`, ADC, `@google/genai` with vertexai.

## Constraints
- **Models:** model IDs from env (`gemini-3.5-flash-lite` / `gemini-3.8-flash` work). **Never Gemini 2.5.**
- **Model errors:** add one retry on 429 / timeout. MATTA hit a 429 on gemini-3.8-flash.
- **Architecture:** one Cloud Run service only (Next.js app + API routes); simplest thing that demos in 3 minutes.
- **Judges:** log in with pre-made email/password test accounts (Firebase Auth); no secrets in git.
- **Submission materials:** README (Japanese), architecture PNG, 3-minute video, submission text.
