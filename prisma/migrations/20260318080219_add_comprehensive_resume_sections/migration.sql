/*
  Warnings:

  - You are about to drop the column `education` on the `resume` table. All the data in the column will be lost.
  - You are about to drop the column `languages` on the `resume` table. All the data in the column will be lost.
  - You are about to drop the column `resumeFileUrl` on the `resume` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `resume` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `resume` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "resume" DROP COLUMN "education",
DROP COLUMN "languages",
DROP COLUMN "resumeFileUrl",
DROP COLUMN "summary",
DROP COLUMN "title",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "interests" TEXT[],
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "professionalSummary" TEXT,
ADD COLUMN     "professionalTitle" TEXT,
ADD COLUMN     "profilePhoto" TEXT,
ADD COLUMN     "softSkills" TEXT[],
ADD COLUMN     "technicalSkills" TEXT[],
ADD COLUMN     "toolsAndTechnologies" TEXT[],
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "work_experience" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "employmentType" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "currentlyWorking" BOOLEAN NOT NULL DEFAULT false,
    "responsibilities" TEXT[],
    "achievements" TEXT[],
    "technologiesUsed" TEXT[],
    "resumeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education" (
    "id" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "currentlyStudying" BOOLEAN NOT NULL DEFAULT false,
    "cgpaOrResult" TEXT,
    "description" TEXT,
    "resumeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certification" (
    "id" TEXT NOT NULL,
    "certificationName" TEXT NOT NULL,
    "issuingOrganization" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "credentialId" TEXT,
    "credentialUrl" TEXT,
    "resumeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "role" TEXT,
    "description" TEXT NOT NULL,
    "technologiesUsed" TEXT[],
    "liveUrl" TEXT,
    "githubUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "highlights" TEXT[],
    "resumeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "proficiencyLevel" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "award" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "resumeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "relationship" TEXT,
    "resumeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "work_experience" ADD CONSTRAINT "work_experience_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education" ADD CONSTRAINT "education_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification" ADD CONSTRAINT "certification_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language" ADD CONSTRAINT "language_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "award" ADD CONSTRAINT "award_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference" ADD CONSTRAINT "reference_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
