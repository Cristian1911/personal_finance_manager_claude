import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getUserSafely } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function getRequestUser(request: NextRequest): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  const supabase = await createClient();

  if (authHeader?.startsWith("Bearer ")) {
    const { data, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (error || !data.user) {
      return null;
    }
    return data.user;
  }

  return getUserSafely(supabase);
}
