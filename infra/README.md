# infra

GCP project `useful-cathode-450302-f0` (shared with MATTA — don't touch `matta-*` resources).

| Resource | Where |
|---|---|
| Cloud Run service `morasan` | asia-east1, SA `sa-web`, max 2 instances, public |
| Firestore database `morasan` | asia-northeast1 (collections `requests`, `audit`) |
| Artifact Registry repo `morasan` | asia-northeast1 |
| IAM | `sa-web`: `roles/datastore.user` conditioned on `databases/morasan` (+ existing aiplatform.user, firebaseauth.viewer, logging.logWriter) |
| Firebase Auth | shared project; users `staff@morasan.demo`, `owner@morasan.demo` |

Steps (ADC: `gcloud auth application-default login`):

```bash
cp .env.example .env.local    # fill in
npm run check:models          # pings both models, refuses Gemini 2.5
npm run seed:users            # create/update demo users + verify sign-in
npm run deploy                # check:models → Cloud Build → Cloud Run; prints the URL
npx tsx --env-file=.env.local scripts/smoke.ts https://morasan-760253059957.asia-east1.run.app
```

`deploy.sh` needs `package-lock.json` committed/present (Dockerfile uses `npm ci`). `IMAGE=<uri> npm run deploy` redeploys an existing image.
