.PHONY: dev dev-online migrate migrate-create

dev:
	env -u REMOTE_API_URL bun run dev

dev-https:
	bunx next dev --experimental-https

# Requires DEV_ONLINE_TOKEN set in .env.local (generate one at opc.ruilisi.com → Settings → API Tokens)
dev-online:
	REMOTE_API_URL=https://opc.ruilisi.com bun run dev

# Run pending migrations against the database pointed to by DATABASE_URL.
# Usage:
#   make migrate                        # uses local .env.local
#   DATABASE_URL=postgres://... make migrate
migrate:
	bunx prisma migrate deploy

# Create a new migration (dev only).
# Usage: make migrate-create NAME=add_something
migrate-create:
	bunx prisma migrate dev --name $(NAME)
