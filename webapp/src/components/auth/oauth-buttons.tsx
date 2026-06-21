"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

type Provider = "google" | "apple";

/**
 * Google + Apple sign-in for the web. Redirects to the provider, which returns
 * to /auth/callback (existing route exchanges the code). Used on login + signup.
 */
export function OAuthButtons({ next = "/dashboard" }: { next?: string }) {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: Provider) {
    setLoading(provider);
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser redirects away; only reached on error.
    if (oauthError) {
      setLoading(null);
      setError(oauthError.message);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-white/6" />
        <span className="text-xs text-muted-foreground">o continúa con</span>
        <div className="h-px flex-1 bg-white/6" />
      </div>

      <Button
        type="button"
        className={cn("w-full", GHOST_BUTTON_CLASS)}
        disabled={loading !== null}
        onClick={() => signIn("google")}
      >
        <GoogleIcon />
        {loading === "google" ? "Conectando…" : "Continuar con Google"}
      </Button>

      <Button
        type="button"
        className={cn("w-full", GHOST_BUTTON_CLASS)}
        disabled={loading !== null}
        onClick={() => signIn("apple")}
      >
        <AppleIcon />
        {loading === "apple" ? "Conectando…" : "Continuar con Apple"}
      </Button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.36 12.78c.03 2.9 2.55 3.86 2.58 3.88-.02.07-.4 1.38-1.33 2.73-.8 1.17-1.64 2.33-2.96 2.36-1.3.02-1.71-.77-3.2-.77-1.48 0-1.94.75-3.17.8-1.27.04-2.24-1.27-3.05-2.43-1.65-2.39-2.91-6.75-1.22-9.7.84-1.46 2.35-2.39 3.98-2.41 1.25-.03 2.43.84 3.2.84.76 0 2.2-1.04 3.71-.89.63.03 2.4.26 3.54 1.92-.09.06-2.11 1.23-2.08 3.66M13.93 4.6c.68-.82 1.14-1.97.99-3.1-.96.04-2.12.64-2.82 1.46-.63.72-1.18 1.88-1.03 2.99 1.07.08 2.17-.54 2.86-1.35" />
    </svg>
  );
}
