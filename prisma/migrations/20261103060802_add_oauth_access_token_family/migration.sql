/*
  Warnings:

  - Added the required column `familyId` to the `OAuthAccessToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OAuthAccessToken" ADD COLUMN     "familyId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "OAuthAccessToken_familyId_idx" ON "OAuthAccessToken"("familyId");
