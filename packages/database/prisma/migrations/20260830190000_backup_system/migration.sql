-- CreateEnum
CREATE TYPE "BackupFrequency" AS ENUM ('OFF', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "BackupStorage" AS ENUM ('LOCAL', 'S3');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "backupFrequency" "BackupFrequency" NOT NULL DEFAULT 'OFF';
ALTER TABLE "organizations" ADD COLUMN "backupLastRunAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "backup_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storage" "BackupStorage" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_records_organizationId_createdAt_idx" ON "backup_records"("organizationId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "backup_records" ADD CONSTRAINT "backup_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
