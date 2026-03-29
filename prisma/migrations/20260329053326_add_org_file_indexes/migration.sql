-- CreateIndex
CREATE INDEX "OrgFile_orgId_folderId_idx" ON "OrgFile"("orgId", "folderId");

-- CreateIndex
CREATE INDEX "OrgFile_orgId_createdAt_idx" ON "OrgFile"("orgId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OrgFileTag_orgId_idx" ON "OrgFileTag"("orgId");

-- CreateIndex
CREATE INDEX "OrgFolder_orgId_idx" ON "OrgFolder"("orgId");
