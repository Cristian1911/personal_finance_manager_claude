/**
 * No-op stand-in for the `server-only` package under vitest.
 *
 * Modules like `lib/personal-debts/recompute.ts` and `lib/personal-debts/ad-hoc.ts`
 * import "server-only" so a client bundle importing them fails the build. That
 * package isn't installed directly (Next resolves it at build time), so any test
 * that reaches one of those modules — even transitively, e.g. through an action —
 * dies on "Cannot find package 'server-only'". Aliasing it here keeps the guard
 * real in the app build while letting unit tests import the same code.
 */
export {};
