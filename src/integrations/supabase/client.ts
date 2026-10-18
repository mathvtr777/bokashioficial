import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== "https://seu-projeto.supabase.co" &&
    supabaseAnonKey !== "sua-anon-key-aqui"
);

// Fallback URL and key so client initialization doesn't throw when not configured yet
const defaultUrl = supabaseUrl || "https://placeholder.supabase.co";
const defaultKey = supabaseAnonKey || "placeholder-anon-key";

export const supabase = createClient<Database>(defaultUrl, defaultKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
