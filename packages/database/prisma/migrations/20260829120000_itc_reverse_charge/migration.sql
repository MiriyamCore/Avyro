-- CreateEnum
CREATE TYPE "ItcStatus" AS ENUM ('CLAIMABLE', 'BLOCKED', 'APPORTIONED', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "bill_items" ADD COLUMN "itcStatus" "ItcStatus" NOT NULL DEFAULT 'CLAIMABLE';
ALTER TABLE "bill_items" ADD COLUMN "itcApportionedPercent" DECIMAL(8,4);

-- AlterTable
ALTER TABLE "bills" ADD COLUMN "reverseCharge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bills" ADD COLUMN "reverseChargeTaxCodeId" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "reverseCharge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expenses" ADD COLUMN "reverseChargeTaxCodeId" TEXT;
