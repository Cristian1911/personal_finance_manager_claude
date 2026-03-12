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
