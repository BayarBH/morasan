# Build context: repo root. Built by infra/cloudbuild.yaml.
FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
# Dev deps included: next build type-checks (typescript, @types/*) and needs tailwind/postcss.
RUN npm ci --no-audit --no-fund

COPY . .

# NEXT_PUBLIC_* are inlined at build time.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npx next build

ENV NODE_ENV=production
CMD ["sh", "-c", "exec node_modules/.bin/next start -p ${PORT:-8080}"]
