-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "invoicePrefix" TEXT DEFAULT 'INV-',
ADD COLUMN     "setupCompletedAt" TIMESTAMP(3);
