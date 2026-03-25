/*
  Warnings:

  - Made the column `orgId` on table `Board` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Board" DROP CONSTRAINT "Board_orgId_fkey";

-- AlterTable
ALTER TABLE "Board" ALTER COLUMN "orgId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
