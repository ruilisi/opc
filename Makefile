.PHONY: dev migrate migrate-create

dev:
	bun run dev

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
