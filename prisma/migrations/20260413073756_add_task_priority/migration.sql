-- DropForeignKey
ALTER TABLE "Doc" DROP CONSTRAINT "Doc_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DocPermission" DROP CONSTRAINT "DocPermission_userId_fkey";

-- AlterTable
ALTER TABLE "Doc" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocPermission" ADD CONSTRAINT "DocPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
