-- Nullable for backward compatibility with projects created before readiness tracking.
ALTER TABLE "Project" ADD COLUMN "discoveryReadiness" JSONB;
