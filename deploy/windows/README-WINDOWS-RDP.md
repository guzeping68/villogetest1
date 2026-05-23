# Windows / RDP Deployment

Use this when the Tencent Cloud server is managed through Windows Remote Desktop instead of SSH.

## 1. Prepare Server

Install:

1. Node.js LTS: `https://nodejs.org/`
2. Caddy for Windows: `https://caddyserver.com/download`

Open Tencent Cloud security group and Windows Firewall:

```text
80/tcp
443/tcp
```

You still need a domain, for example:

```text
api.your-domain.com -> 43.156.226.113
```

## 2. Copy Files

Copy the deployment folder or zip to the server, for example:

```text
C:\LingoVilleServer
```

## 3. Edit `.env`

In PowerShell:

```powershell
cd C:\LingoVilleServer
copy env.server.example .env
notepad .env
```

Fill:

```text
API_DOMAIN=api.your-domain.com
OPENAI_API_KEY=your_bigmodel_key
PGPASSWORD=your_postgres_password
```

Keep:

```text
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

## 4. Start Backend

Open PowerShell:

```powershell
cd C:\LingoVilleServer
powershell -ExecutionPolicy Bypass -File windows\start-lingoville.ps1
```

Leave this window open.

## 5. Start HTTPS Proxy

Open another PowerShell:

```powershell
cd C:\LingoVilleServer
powershell -ExecutionPolicy Bypass -File windows\start-caddy.ps1
```

Leave this window open. Caddy will apply HTTPS automatically after the domain points to the server and ports `80/443` are open.

## 6. Test

On your Mac:

```bash
curl https://api.your-domain.com/api/health
```

Expected:

```json
{"status":"ok"}
```

## 7. Build iOS

When the API works:

```bash
VITE_API_BASE_URL="https://api.your-domain.com" npm run build
npx cap sync ios
```
