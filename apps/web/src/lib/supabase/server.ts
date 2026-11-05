import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseKey, supabaseUrl } from "./env";

/** Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh happens in the proxy once auth is added.
        }
      },
    },
  });
}
