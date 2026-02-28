import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserSafely } from "@/lib/supabase/auth";

export default async function HomePage() {
  const supabase = await createClient();
  const user = await getUserSafely(supabase);

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
