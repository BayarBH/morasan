#!/usr/bin/env bash
# Model check → Cloud Build image → Cloud Run deploy of `morasan`. Echoes every command.
# Usage: npm run deploy   (or: bash infra/deploy.sh). IMAGE=<existing image> skips the build.
set -euo pipefail

PROJECT="${PROJECT:-useful-cathode-450302-f0}"
REGION="${REGION:-asia-northeast1}"       # Cloud Build + Artifact Registry (repo `morasan`)
RUN_REGION="${RUN_REGION:-asia-east1}"    # Cloud Run (asia-northeast1 hit ProjectInitFailedQuotaExceeded for MATTA)
SERVICE=morasan
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
SA_WEB="sa-web@${PROJECT}.iam.gserviceaccount.com"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
URL="https://${SERVICE}-${PROJECT_NUMBER}.${RUN_REGION}.run.app"
REPO="${REGION}-docker.pkg.dev/${PROJECT}/morasan"
if SHA="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null)"; then TAG="${SHA}-$(date +%Y%m%d%H%M%S)"; else TAG="$(date +%Y%m%d%H%M%S)"; fi

run() { echo "+ $*"; "$@"; }
# First deploys to a region can fail with a transient ProjectInitFailedQuotaExceeded.
retry() { local i; for i in 1 2 3 4; do echo "+ (try $i) $*"; "$@" && return 0; sleep 60; done; return 1; }
getv() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r'; }

[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE (see .env.example)" >&2; exit 1; }
MODEL_FAST="$(getv MODEL_FAST)"
MODEL_SMART="$(getv MODEL_SMART)"
DATA_OWNER_EMAIL="$(getv DATA_OWNER_EMAIL)"

cd "$ROOT"
echo "== Model check (must pass before every deploy)"
run npm run check:models

echo "== Artifact Registry"
gcloud artifacts repositories describe morasan --location="$REGION" --project "$PROJECT" >/dev/null 2>&1 ||
  run gcloud artifacts repositories create morasan --repository-format=docker --location="$REGION" --project "$PROJECT"

echo "== Build"
if [[ -n "${IMAGE:-}" ]]; then echo "reusing $IMAGE"; else
  IMAGE="${REPO}/web:${TAG}"
  run gcloud builds submit . --project "$PROJECT" --region "$REGION" --config infra/cloudbuild.yaml \
    --substitutions="_IMAGE=${IMAGE},_NEXT_PUBLIC_FIREBASE_API_KEY=$(getv NEXT_PUBLIC_FIREBASE_API_KEY),_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$(getv NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),_NEXT_PUBLIC_FIREBASE_PROJECT_ID=$(getv NEXT_PUBLIC_FIREBASE_PROJECT_ID),_NEXT_PUBLIC_FIREBASE_APP_ID=$(getv NEXT_PUBLIC_FIREBASE_APP_ID)"
fi

echo "== Deploy"
retry gcloud run deploy "$SERVICE" --project "$PROJECT" --region "$RUN_REGION" --image "$IMAGE" \
  --service-account "$SA_WEB" --allow-unauthenticated --no-invoker-iam-check --max-instances=2 \
  --set-env-vars="^;^NODE_ENV=production;GOOGLE_CLOUD_PROJECT=${PROJECT};GOOGLE_CLOUD_LOCATION=global;MODEL_FAST=${MODEL_FAST};MODEL_SMART=${MODEL_SMART};FIRESTORE_DATABASE_ID=morasan;DATA_OWNER_EMAIL=${DATA_OWNER_EMAIL}"

echo "== URL: ${URL}"
echo "Next: npx tsx --env-file=.env.local scripts/smoke.ts ${URL}"
