import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseKey, supabaseUrl } from "./env";

/** Supabase client for Client Components. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
