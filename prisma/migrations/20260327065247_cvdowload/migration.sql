-- CreateTable
CREATE TABLE "cv_download" (
    "id" TEXT NOT NULL,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recruiterId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,

    CONSTRAINT "cv_download_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cv_download_recruiterId_idx" ON "cv_download"("recruiterId");

-- CreateIndex
CREATE INDEX "cv_download_candidateId_idx" ON "cv_download"("candidateId");

-- CreateIndex
CREATE INDEX "cv_download_downloadedAt_idx" ON "cv_download"("downloadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cv_download_recruiterId_candidateId_key" ON "cv_download"("recruiterId", "candidateId");

-- AddForeignKey
ALTER TABLE "cv_download" ADD CONSTRAINT "cv_download_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_download" ADD CONSTRAINT "cv_download_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
