-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "aiConfidence" DOUBLE PRECISION,
ADD COLUMN     "aiRationale" TEXT,
ADD COLUMN     "aiSuggested" BOOLEAN NOT NULL DEFAULT false;
