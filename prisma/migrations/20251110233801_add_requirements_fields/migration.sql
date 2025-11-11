-- AlterTable
ALTER TABLE "Project" ADD COLUMN "requirementsExtractedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "requirementsMarkdown" TEXT;
ALTER TABLE "Project" ADD COLUMN "requirementsMermaid" TEXT;
