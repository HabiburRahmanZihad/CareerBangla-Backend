-- Remove DRAFT from JobStatus and map existing DRAFT records to PENDING

CREATE TYPE "JobStatus_new" AS ENUM ('PENDING', 'LIVE', 'INACTIVE', 'CLOSED');

ALTER TABLE "job" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "job"
ALTER COLUMN "status" TYPE "JobStatus_new"
USING (
  CASE
    WHEN status::text = 'DRAFT' THEN 'PENDING'
    WHEN status::text = 'ACTIVE' THEN 'LIVE'
    ELSE status::text
  END
)::"JobStatus_new";

DROP TYPE "JobStatus";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";

ALTER TABLE "job" ALTER COLUMN "status" SET DEFAULT 'PENDING';
