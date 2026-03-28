-- AlterTable
ALTER TABLE "OrgInvite" ADD COLUMN     "maxUses" INTEGER,
ADD COLUMN     "useCount" INTEGER NOT NULL DEFAULT 0;
