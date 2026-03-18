/*
  Warnings:

  - You are about to drop the column `certifications` on the `resume` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "resume" DROP COLUMN "certifications",
ADD COLUMN     "certifications_legacy" JSONB[];
