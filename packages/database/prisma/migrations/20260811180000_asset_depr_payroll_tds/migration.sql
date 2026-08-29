-- AlterTable
ALTER TABLE "people" ADD COLUMN "tdsPercent" DECIMAL(8,4);

-- AlterTable
ALTER TABLE "assets" ADD COLUMN "usefulLifeMonths" INTEGER,
ADD COLUMN "salvageValue" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "depreciationMethod" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE';
