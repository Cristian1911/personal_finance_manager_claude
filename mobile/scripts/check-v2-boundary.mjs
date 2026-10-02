// v2 must not grow on v1 code (S9-1: v1 is deleted after the data migration).
// v2 files may import v1 only from this allow-list.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const V2_DIRS = ["app/(v2)", "v2", "lib/v2", "app/v2-gallery.tsx"];
const ALLOWED = ["lib/auth", "lib/utils/date", "lib/supabase"];
const isV2 = (p) => V2_DIRS.some((d) => p === d || p.startsWith(d + "/") || p.startsWith(d.replace(/\.tsx$/, "")));

const files = [];
const walk = (p) => statSync(p).isDirectory() ? readdirSync(p).forEach((f) => walk(join(p, f))) : /\.tsx?$/.test(p) && files.push(p);
V2_DIRS.forEach((d) => walk(join(root, d)));

const bad = [];
for (const f of files) {
  for (const [, spec] of readFileSync(f, "utf8").matchAll(/(?:from|import\(|require\()\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = relative(root, resolve(dirname(f), spec));
    if (!isV2(target) && !ALLOWED.some((a) => target === a || target.startsWith(a + "/"))) bad.push(`${relative(root, f)} → ${target}`);
  }
}
if (bad.length) {
  console.error("v2 imports v1 code (allowed: " + ALLOWED.join(", ") + "):\n  " + bad.join("\n  "));
  process.exit(1);
}
console.log(`v2 boundary ok (${files.length} files)`);
