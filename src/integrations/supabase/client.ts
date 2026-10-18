import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const FALLBACK_URL = "https://gnelpocqtzphzmmsouix.supabase.co";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWxwb2NxdHpwaHptbXNvdWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjY1ODQsImV4cCI6MjEwNzYwMjU4NH0.-ZB2bXRNfrMv4En-ZcDr2hbCr4yu4AiJ9jWu-5bSrnc";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] || FALLBACK_URL;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] || FALLBACK_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== "https://seu-projeto.supabase.co" &&
    supabaseAnonKey !== "sua-anon-key-aqui"
);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
