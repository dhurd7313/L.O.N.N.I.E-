import { createClient } from "@supabase/supabase-js";

// Environment variables (set in .env file)
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not configured. Auth will be disabled.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type exports for convenience
export type { User, Session, AuthError } from "@supabase/supabase-js";