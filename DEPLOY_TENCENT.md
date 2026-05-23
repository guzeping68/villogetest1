# Tencent Cloud Deployment

The mobile app cannot call PostgreSQL or an AI provider directly. It must call this project's Node/Express backend over HTTPS:

```text
iOS App -> https://your-api-domain.com/api/... -> Node backend -> BigModel / PostgreSQL
```

## Requirements

1. A domain or subdomain, for example `api.example.com`.
2. DNS `A` record pointing that domain to `43.156.226.113`.
3. Tencent Cloud security group opens `80` and `443`.
4. SSH access to the server, usually port `22`.
5. Docker and Docker Compose installed on the server.

## Server `.env`

On the server, copy `deploy/env.server.example` to `.env`, then fill in the real secrets:

```bash
cp deploy/env.server.example .env
nano .env
```

Use these important values:

```bash
API_DOMAIN=api.example.com
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4.7-flash
OPENAI_MODELS=glm-4.7-flash
AI_TIMEOUT_MS=45000
AI_MAX_TOKENS=1200
AI_THINKING=disabled
PGHOST=43.156.226.113
PGPORT=5432
PGUSER=postgres
PGDATABASE=postgres
```

Do not put `OPENAI_API_KEY` or `PGPASSWORD` into frontend files, `src/`, `dist/`, or `ios/App/App/public/`.

## Start Backend

From the project root on the server:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

Test:

```bash
curl https://api.example.com/api/health
```

Expected:

```json
{"status":"ok"}
```

## Build iOS App

After the HTTPS API is working, build the mobile app locally with the same API URL:

```bash
VITE_API_BASE_URL="https://api.example.com" npm run build
npx cap sync ios
```

Then open the iOS project in Xcode and archive.

## Why HTTPS Is Required

iOS production builds should call HTTPS APIs. Avoid using `http://43.156.226.113` in a released app because iOS App Transport Security may block it and the API key/database password must remain on the server.
