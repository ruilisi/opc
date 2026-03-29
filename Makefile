.PHONY: dev dev-online migrate migrate-create

dev:
	bun run dev

dev-https:
	bunx next dev --experimental-https

dev-online:
	NEXT_PUBLIC_API_BASE=https://opc.ruilisi.com bun run dev

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
