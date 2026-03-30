-- AlterTable
ALTER TABLE "job" ADD COLUMN     "allowVideoCv" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featuredJob" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "urgentHiring" BOOLEAN NOT NULL DEFAULT false;
