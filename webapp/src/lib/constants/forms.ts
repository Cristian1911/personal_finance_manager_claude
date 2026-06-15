/**
 * Props that suppress the browser's saved-password autofill on a password
 * field. `autoComplete="off"` is silently ignored by Chrome for inputs of
 * `type="password"`, so we use `new-password` (the only value Chrome honors as
 * "do not offer saved credentials") plus the opt-out attributes recognized by
 * the major password managers.
 *
 * Use for PDF-password fields and similar one-off secrets that are NOT the
 * user's site credentials — offering site logins there is noise, and saving
 * the typed value into the browser's password store is wrong.
 */
export const NO_PASSWORD_AUTOFILL_PROPS = {
  autoComplete: "new-password",
  "data-1p-ignore": true,
  "data-lpignore": true,
  "data-bwignore": true,
  "data-form-type": "other",
} as const;
