-- Organization defaults are optional so existing companies continue to load.
ALTER TABLE "Company" ADD COLUMN "discoveryPreferences" JSONB;
