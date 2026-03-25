# OPC — Project Management

Kanban-based project management for small teams and solo founders.

## Features

- **Multi-board kanban** with drag-and-drop ([@hello-pangea/dnd](https://github.com/hello-pangea/dnd))
- **Rich task management** — markdown content, story points, assignees, AI model tags
- **Qiniu image uploads** with MD5 deduplication (paste images directly in markdown editor)
- **Sentry integration** — manage multiple Sentry accounts, view top issues
- **AI auto-solve** — `/auto-solve-tasks` skill dispatches tasks to Claude/GPT/Gemini CLIs
- **OAuth login** — bring your own OAuth 2.0 provider, no email/password needed

## Quick Start

```bash
git clone https://github.com/your-org/opc
cd opc
bun install
cp .env.local.example .env.local
# Fill in the variables in .env.local (see below)
bunx prisma migrate dev --name init
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | 32+ random bytes for session signing |
| `NEXT_PUBLIC_OAUTH_WEB_URL` | OAuth consent page base URL (e.g. `https://your-auth.example.com`) |
| `NEXT_PUBLIC_OAUTH_API_URL` | OAuth API base URL for token exchange and userinfo |
| `NEXT_PUBLIC_OAUTH_CLIENT_ID` | OAuth client ID (default: `opc`) |
| `OAUTH_CLIENT_SECRET` | OAuth client secret |
| `QINIU_ACCESS_KEY` | Qiniu access key (optional, for image uploads) |
| `QINIU_SECRET_KEY` | Qiniu secret key |
| `QINIU_BUCKET` | Qiniu bucket name |
| `QINIU_DOMAIN` | Qiniu CDN domain |
| `QINIU_FOLDER` | Qiniu key prefix / subfolder (optional) |

## OAuth Setup

OPC uses the standard OAuth 2.0 authorization code flow. You need an OAuth provider that supports:
- `GET /oauth/authorize` — authorization endpoint
- `POST /oauth/token` — token endpoint
- `GET /oauth/userinfo` — returns `{ id, nickname, avatar_url, email }`

Register a client with redirect URI `https://your-opc-domain.com/oauth/callback` and set the credentials in `.env.local`.

## API Token (for CLI/skill access)

Go to **Settings → API Tokens** to generate a token for CLI use.

## Auto-Solve Skill

```bash
OPC_API_URL=http://localhost:3000 OPC_API_TOKEN=opc_... claude /auto-solve-tasks <board-id>
```

The skill reads tasks from the first column of the board and dispatches each to the AI CLI matching its `aiModelTag` (claude-*, gpt-*, gemini-*).
