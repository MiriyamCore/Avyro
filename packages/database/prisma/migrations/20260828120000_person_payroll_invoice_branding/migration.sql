-- AlterTable: BD payroll employee fields
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "nationalId" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "taxIdentifier" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "terminationDate" DATE;

-- AlterTable: invoice PDF customization
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "invoicePrimaryColor" TEXT DEFAULT '#0f3d3a';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "invoiceAccentColor" TEXT DEFAULT '#c45c26';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "invoiceTemplate" TEXT DEFAULT 'wave';
