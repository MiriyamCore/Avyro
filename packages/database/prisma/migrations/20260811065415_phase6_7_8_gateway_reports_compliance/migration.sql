-- CreateEnum
CREATE TYPE "GatewayCheckoutStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'SETTLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ComplianceRecordType" AS ENUM ('TRADE_LICENCE', 'TIN', 'BIN_VAT', 'FORM_C', 'ERQ', 'OTHER');

-- CreateTable
CREATE TABLE "gateway_checkouts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "status" "GatewayCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'MOCK',
    "providerRef" TEXT,
    "feeAmount" DECIMAL(18,6),
    "feePercent" DECIMAL(8,6) NOT NULL DEFAULT 0.025,
    "paymentId" TEXT,
    "clearingAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "succeededAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "gateway_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'BD',
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ComplianceRecordType" NOT NULL,
    "label" TEXT NOT NULL,
    "identifier" TEXT,
    "issuedOn" DATE,
    "expiresOn" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ratePercent" DECIMAL(8,4),
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gateway_checkouts_token_key" ON "gateway_checkouts"("token");

-- CreateIndex
CREATE INDEX "gateway_checkouts_organizationId_invoiceId_idx" ON "gateway_checkouts"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "gateway_checkouts_organizationId_status_idx" ON "gateway_checkouts"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_profiles_organizationId_key" ON "compliance_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "compliance_records_organizationId_type_idx" ON "compliance_records"("organizationId", "type");

-- CreateIndex
CREATE INDEX "tax_codes_organizationId_kind_idx" ON "tax_codes"("organizationId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_organizationId_code_effectiveFrom_key" ON "tax_codes"("organizationId", "code", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "gateway_checkouts" ADD CONSTRAINT "gateway_checkouts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_profiles" ADD CONSTRAINT "compliance_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
