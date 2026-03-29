-- CreateTable
CREATE TABLE "OrgFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "folderId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgFileTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgFileTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgFileTagAssignment" (
    "fileId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "OrgFileTagAssignment_pkey" PRIMARY KEY ("fileId","tagId")
);

-- AddForeignKey
ALTER TABLE "OrgFolder" ADD CONSTRAINT "OrgFolder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFolder" ADD CONSTRAINT "OrgFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFolder" ADD CONSTRAINT "OrgFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFile" ADD CONSTRAINT "OrgFile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFile" ADD CONSTRAINT "OrgFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "OrgFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFile" ADD CONSTRAINT "OrgFile_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFileTag" ADD CONSTRAINT "OrgFileTag_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFileTagAssignment" ADD CONSTRAINT "OrgFileTagAssignment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "OrgFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFileTagAssignment" ADD CONSTRAINT "OrgFileTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "OrgFileTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
