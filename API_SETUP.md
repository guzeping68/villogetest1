# API Setup

AI 定制答题和错题复习都通过后端接口生成内容：

```text
POST /api/review/generate/custom
POST /api/review/generate
```

## 本地开发

本地运行时可以不配置 `VITE_API_BASE_URL`，前端会请求同源接口：

```bash
npm run dev
```

访问：

```text
http://127.0.0.1:3000
```

如果没有配置任何 AI 服务，后端会立刻返回 fallback 练习内容，保证按钮不会卡住。

## 打包 iOS / Android

Capacitor 打包后，App 运行在本地壳里，不能再用相对路径 `/api/...` 找到后端。构建前必须配置你的 HTTPS 服务器地址。

移动端只需要构建前端：

```bash
VITE_API_BASE_URL="https://你的服务器域名" npm run build
npx cap sync ios
```

服务器必须能访问：

```text
https://你的服务器域名/api/health
https://你的服务器域名/api/review/generate/custom
```

## 后端 AI 配置

推荐先用 Groq：速度快、接入简单，接口兼容 OpenAI 格式。Key 需要你自己登录 Groq Console 创建，创建后只放在服务器 `.env`，不要放进前端或 iOS 包。

```bash
GROQ_API_KEY="你的Groq key"
GROQ_MODEL="llama-3.1-8b-instant"
AI_TIMEOUT_MS=20000
```

也可以接任意 OpenAI-compatible 服务，兼容你自己的服务器或第三方中转：

```bash
OPENAI_BASE_URL="https://你的模型服务/v1"
OPENAI_API_KEY="你的key"
OPENAI_MODEL="你的模型名"
AI_TIMEOUT_MS=20000
```

如果 Groq 返回 `403 Forbidden`，通常是账号权限、模型权限、账单/额度、或当前网络/服务器地区被拒绝。国内部署可以优先试 SiliconFlow 硅基流动，它也是 OpenAI-compatible：

```bash
OPENAI_BASE_URL="https://api.siliconflow.cn/v1"
OPENAI_API_KEY="你的SiliconFlow key"
OPENAI_MODEL="Qwen/Qwen2-7B-Instruct"
AI_TIMEOUT_MS=20000
```

智谱 BigModel 也支持 OpenAI-compatible，国内网络通常更稳：

```bash
OPENAI_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
OPENAI_API_KEY="你的智谱BigModel key"
OPENAI_MODEL="glm-4.7-flash"
OPENAI_MODELS="glm-4.7-flash"
AI_TIMEOUT_MS=45000
AI_MAX_TOKENS=1200
AI_THINKING=disabled
```

`OPENAI_MODELS` 是可选的模型候选列表，前一个模型失败时会自动试下一个。

如果用 Gemini：

```bash
GEMINI_API_KEY="你的Gemini key"
GEMINI_MODELS="gemini-3.1-flash-lite,gemini-2.5-flash-lite,gemini-2.5-flash"
```

两者都不配置时，后端会使用本地 fallback 数据。

## 进度存储

服务端进度存储使用 PostgreSQL。可以配置：

```bash
DATABASE_URL="postgres://user:password@host:5432/dbname"
```

或：

```bash
PGHOST=
PGPORT=5432
PGUSER=
PGPASSWORD=
PGDATABASE=
```

不配置数据库时，进度接口会返回空数据并跳过保存，不会再拖慢启动。

## 服务器部署建议

推荐用一台服务器跑 Node 后端，外面套 HTTPS 域名：

```bash
npm ci
npm run build:all
NODE_ENV=production npm start
```

也可以用 Docker：

```bash
docker compose up -d --build
```

iOS App 里只能写公开的 `VITE_API_BASE_URL`，例如：

```bash
VITE_API_BASE_URL="https://api.your-domain.com"
```

AI Key、数据库密码只能放服务器环境变量里。不要让 App 直连 PostgreSQL，也不要把 Key 写进 `src/`、`dist/`、`ios/App/App/public/`。

腾讯云部署的完整步骤见 `DEPLOY_TENCENT.md`。
