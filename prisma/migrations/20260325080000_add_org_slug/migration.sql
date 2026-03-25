-- Add slug column with a temporary default, backfill, then enforce unique
ALTER TABLE "Organization" ADD COLUMN "slug" TEXT;
UPDATE "Organization" SET "slug" = lower(regexp_replace(name, '[^a-zA-Z0-9]', '-', 'g')) WHERE "slug" IS NULL;
ALTER TABLE "Organization" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
