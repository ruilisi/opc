CREATE TABLE "Doc" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "ydocState" BYTEA,
  "orgId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "slug" TEXT,
  "publicAccess" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Doc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Doc_slug_key" ON "Doc"("slug");

CREATE TABLE "DocPermission" (
  "id" TEXT NOT NULL,
  "docId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  CONSTRAINT "DocPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocPermission_docId_userId_key" ON "DocPermission"("docId", "userId");

ALTER TABLE "Doc" ADD CONSTRAINT "Doc_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "DocPermission" ADD CONSTRAINT "DocPermission_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocPermission" ADD CONSTRAINT "DocPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE;
