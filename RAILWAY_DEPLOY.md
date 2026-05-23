# Railway Deployment

Railway is simpler than a Tencent Cloud VPS for this app because it can deploy directly from GitHub and provide an HTTPS domain automatically.

## What Railway Runs

This repo deploys one Node/Express service:

```text
iOS App -> https://your-service.up.railway.app/api/... -> Express backend -> BigModel / PostgreSQL
```

Railway uses:

```text
railway.json
Dockerfile
npm start
```

The backend listens on `0.0.0.0:$PORT`, so it works with Railway's public networking.

## Recommended Database

Use Railway PostgreSQL first. It is easier than connecting back to Tencent Cloud PostgreSQL, and Railway can expose it to the backend through `DATABASE_URL`.

In Railway:

1. Add a PostgreSQL service to the same project.
2. In the LingoVille app service, add a reference variable:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

If your PostgreSQL service name is different, choose its `DATABASE_URL` from Railway's variable reference UI.

## Required Variables

In Railway service Variables, add:

```bash
NODE_ENV=production

OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_API_KEY=your_bigmodel_key
OPENAI_MODEL=glm-4.7-flash
OPENAI_MODELS=glm-4.7-flash
AI_TIMEOUT_MS=45000
AI_MAX_TOKENS=1200
AI_THINKING=disabled

DATABASE_URL=${{Postgres.DATABASE_URL}}
DB_CONNECTION_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=30000
DB_POOL_MAX=5
```

Do not commit real keys or passwords to GitHub.

## Railway Steps

1. Push this folder to GitHub.
2. In Railway: New Project -> Deploy from GitHub repo.
3. Choose this repository.
4. Add PostgreSQL in the same Railway project.
5. Add the variables above to the LingoVille app service.
6. Generate a Railway domain.
7. Test:

```bash
curl https://your-service.up.railway.app/api/health
```

Expected:

```json
{"status":"ok"}
```

## Build iOS With Railway API

After Railway is live:

```bash
VITE_API_BASE_URL="https://your-service.up.railway.app" npm run build
npx cap sync ios
```

Then archive in Xcode.
