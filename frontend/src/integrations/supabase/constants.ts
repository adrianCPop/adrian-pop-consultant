// When running self-hosted Supabase locally, set VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY in frontend/.env. Falls back to the cloud project.
export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://wvcnymlvoouryxuriqtl.supabase.co";

export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2Y255bWx2b291cnl4dXJpcXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2ODU0ODQsImV4cCI6MjA2ODI2MTQ4NH0.GEqlRCi9Ejj4ew5OEwCu9yAY1I-mw_OL1HBe2CtCH4A";

export const VALIDATE_RULES_FN = "validate-rules";

