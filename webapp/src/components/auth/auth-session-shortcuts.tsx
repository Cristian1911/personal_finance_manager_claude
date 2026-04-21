import { startDemoSession, startGuestSession } from "@/actions/demo";

/**
 * Two text-link shortcuts rendered under the login + signup forms:
 * start a guest session (empty onboarding) or start a demo session
 * (pre-seeded mock data). Both post to server actions so no JS is needed.
 */
export function AuthSessionShortcuts() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <form action={startGuestSession}>
        <button
          type="submit"
          className="text-sm text-z-sage-dark underline-offset-4 hover:text-z-white hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-z-brass/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:underline"
        >
          Usar sin cuenta →
        </button>
      </form>
      <form action={startDemoSession}>
        <button
          type="submit"
          className="text-xs text-z-sage-dark/80 underline-offset-4 hover:text-z-white hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-z-brass/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:underline"
        >
          o ver el demo con datos de ejemplo
        </button>
      </form>
    </div>
  );
}
