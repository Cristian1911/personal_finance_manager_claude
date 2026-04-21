#!/usr/bin/env node
/**
 * Reset / hard-delete a test user so you can re-run onboarding, demo,
 * empty-state flows, etc.
 *
 * Deleting the `auth.users` row cascades through every FK in the schema —
 * profiles_enc, accounts (+ transactions, snapshots), budgets, destinatarios,
 * recurring templates, DEK, etc. all go with it.
 *
 * Usage (from repo root):
 *   node scripts/reset-user.js test@example.com             # dry-run
 *   node scripts/reset-user.js test@example.com --execute   # apply
 *   node scripts/reset-user.js --all-anonymous              # list all anonymous
 *   node scripts/reset-user.js --all-anonymous --execute    # wipe them
 *
 * Env: reads webapp/.env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY.
 */

const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const ALL_ANON = args.includes("--all-anonymous");
const email = args.find((a) => !a.startsWith("--"));

if (!email && !ALL_ANON) {
  console.error("Usage: node scripts/reset-user.js <email> [--execute]");
  console.error("       node scripts/reset-user.js --all-anonymous [--execute]");
  process.exit(1);
}

function loadEnv() {
  const envPath = path.resolve(__dirname, "..", "webapp", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(`[reset-user] Missing ${envPath}`);
    process.exit(1);
  }
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = rawLine.replace(/^\s*export\s+/, "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("[reset-user] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY missing");
  process.exit(1);
}

const { createClient } = require(
  path.resolve(__dirname, "..", "webapp", "node_modules", "@supabase", "supabase-js"),
);

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listAllUsers() {
  const all = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < 1000) break;
    page += 1;
  }
  return all;
}

async function hardDelete(userId) {
  const { error } = await admin.auth.admin.deleteUser(userId, false);
  if (error) throw error;
}

(async () => {
  const users = await listAllUsers();

  let targets;
  if (ALL_ANON) {
    targets = users.filter((u) => u.is_anonymous);
  } else {
    targets = users.filter((u) => u.email === email);
  }

  if (targets.length === 0) {
    console.log(`[reset-user] No matching users found.`);
    return;
  }

  console.log(`[reset-user] Found ${targets.length} user(s):`);
  for (const u of targets) {
    console.log(
      `  - ${u.id}  ${u.email ?? "(anon)"}  created ${u.created_at}  anonymous=${!!u.is_anonymous}`,
    );
  }

  if (!EXECUTE) {
    console.log("\n[reset-user] Dry-run. Re-run with --execute to hard-delete.");
    return;
  }

  console.log("\n[reset-user] Deleting…");
  for (const u of targets) {
    try {
      await hardDelete(u.id);
      console.log(`  ✓ deleted ${u.email ?? "(anon)"} (${u.id})`);
    } catch (err) {
      console.error(`  ✗ failed ${u.id}: ${err.message ?? err}`);
    }
  }
  console.log("[reset-user] Done.");
})().catch((err) => {
  console.error("[reset-user] Fatal:", err);
  process.exit(1);
});
