# White Circle Assessment — AI Chat

Next.js application with real‑time OpenAI streaming, server‑side PII detection, and PostgreSQL (Prisma) persistence.

## Features

- Real-time chat streaming (SSE) from OpenAI
- Server-side PII detection during streaming; client highlights PII in red as it arrives
- Chat/message persistence in PostgreSQL via Prisma
- Sidebar with chat history; new chat is created after the first sent message
- Docker Compose for local Postgres

## Prerequisites

- Node.js 20+ and npm
- Docker Desktop (for PostgreSQL)

## From scratch setup

1) Install dependencies
```
npm install
```

2) Configure environment
```
cp .env.local.example .env
# Open .env and set OPENAI_API_KEY (and adjust DATABASE_URL if needed)
```

3) Quick start with automatic migrations and seeds
```
npm run dev:seed
```
This will:
- start Docker Compose (PostgreSQL)
- apply Prisma migrations
- seed the DB with 4 example chats
- start Next.js at http://localhost:3000

Open http://localhost:3000/chat to use the chat UI.

Alternative (no auto-seed):
```
npm run dev
# in another terminal if needed
npm run db:deploy && npm run db:seed
```

## Available scripts

- `npm run dev` — start Docker and Next.js (no seeding)
- `npm run dev:seed` — start Docker, migrate, seed, then start Next.js
- `npm run db:migrate` — prisma migrate dev (create/apply local migration)
- `npm run db:deploy` — apply existing migrations
- `npm run db:seed` — run seeds (prisma/seed.mjs)
- `npm run db:reset` — reset database and optionally re-seed

## Project structure

```
app/
	api/
		chat/
			route.ts          # Non-streaming chat endpoint
			stream/route.ts   # Streaming with SSE + server PII detection
		chats/
			route.ts          # List/create chats
			[id]/
				route.ts        # Get chat by ID
				messages/route.ts # Add message to chat
	chat/
		page.tsx            # Page with sidebar + chat area
		ChatArea.tsx        # Chat component (stream rendering)
		SidePanel.tsx       # History sidebar
lib/
	chatClient.ts         # Client-side API helpers
	prisma.ts             # Prisma client singleton
prisma/
	schema.prisma         # Chat and Message models
	seed.mjs              # Seed script (creates 4 chats)
```

## Environment variables

Required:
- `OPENAI_API_KEY` — OpenAI API key
- `DATABASE_URL` — Postgres connection string (defaults to local docker-compose instance)

Optional:
- `OPENAI_MODEL` — model name (defaults to gpt-4o-mini)

## Notes

- SSE stream server sends JSON events like `{ type: "delta", delta: string, pii: boolean }`.
- On the client, the last assistant message is rendered incrementally; segments with `pii: true` are highlighted in red.

## Learn more

- Next.js — https://nextjs.org/docs
- Prisma — https://www.prisma.io/docs
- OpenAI API — https://platform.openai.com/docs
