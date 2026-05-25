/**
 * Whether a destinatario-assign flow may overwrite a transaction's
 * `merchant_name` (its display title). A user-locked title is preserved unless
 * the caller explicitly opts in (e.g. the user confirmed the replacement).
 */
export function shouldOverwriteTitle(args: {
  titleLocked: boolean;
  overwriteTitle: boolean;
}): boolean {
  return !args.titleLocked || args.overwriteTitle;
}
