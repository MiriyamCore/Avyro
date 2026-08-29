-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "quotePrefix" TEXT DEFAULT 'Q-';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "invoiceFooter" TEXT;
