/**
 * Capitalize each word in a string.
 * "hello world" → "Hello World"
 */
export function capitalize(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Accent- and case-insensitive fold for client-side search filters. */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Generate a URL-safe slug from a string. Strips accents, lowercases, max 50 chars. */
export function generateSlug(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
