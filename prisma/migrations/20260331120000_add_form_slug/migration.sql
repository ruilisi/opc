ALTER TABLE "BoardForm" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "BoardForm_slug_key" ON "BoardForm"("slug");
