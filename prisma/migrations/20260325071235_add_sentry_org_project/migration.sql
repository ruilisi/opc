-- CreateTable
CREATE TABLE "SentryOrg" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgSlug" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "opcOrgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentryOrg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentryProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectSlug" TEXT NOT NULL,
    "dsn" TEXT NOT NULL,
    "sentryOrgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentryProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SentryOrg_opcOrgId_orgSlug_key" ON "SentryOrg"("opcOrgId", "orgSlug");

-- CreateIndex
CREATE UNIQUE INDEX "SentryProject_sentryOrgId_projectSlug_key" ON "SentryProject"("sentryOrgId", "projectSlug");

-- AddForeignKey
ALTER TABLE "SentryOrg" ADD CONSTRAINT "SentryOrg_opcOrgId_fkey" FOREIGN KEY ("opcOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentryProject" ADD CONSTRAINT "SentryProject_sentryOrgId_fkey" FOREIGN KEY ("sentryOrgId") REFERENCES "SentryOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
