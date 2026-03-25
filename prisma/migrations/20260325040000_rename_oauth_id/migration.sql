-- Rename lingtiId to oauthId
ALTER TABLE "User" RENAME COLUMN "lingtiId" TO "oauthId";
ALTER INDEX "User_lingtiId_key" RENAME TO "User_oauthId_key";
