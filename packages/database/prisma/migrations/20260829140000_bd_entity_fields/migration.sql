-- Customer BD fields
ALTER TABLE "customers" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "customers" ADD COLUMN "billingAddress" TEXT;
ALTER TABLE "customers" ADD COLUMN "shippingAddress" TEXT;
ALTER TABLE "customers" ADD COLUMN "creditLimit" DECIMAL(18,6);

UPDATE "customers" SET "billingAddress" = "address" WHERE "billingAddress" IS NULL AND "address" IS NOT NULL;

-- Supplier BD fields
ALTER TABLE "suppliers" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "address" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "billingAddress" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "shippingAddress" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "suppliers" ADD COLUMN "bankName" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "bankBranch" TEXT;

-- Person photo / NID document
ALTER TABLE "people" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "people" ADD COLUMN "nidDocumentUrl" TEXT;
