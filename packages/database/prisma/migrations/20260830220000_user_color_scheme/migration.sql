-- AlterTable
CREATE TYPE "ColorScheme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

ALTER TABLE "users" ADD COLUMN "colorScheme" "ColorScheme" NOT NULL DEFAULT 'DARK';
