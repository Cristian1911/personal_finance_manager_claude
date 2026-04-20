/**
 * Capture-handoff spec
 *
 * Regenerates the 18 mobile screenshots in
 * `zetas_design_system_handoff/mobile-screens/` at 390×844.
 *
 * Run:
 *   TEST_PASSWORD=... npx playwright test capture-handoff --project=mobile
 *
 * Auth pages (login/signup/forgot-password) captured in a second project
 * without storageState — run the --project=mobile-noauth variant if you add it,
 * or just rely on the unauth tests below which clear storage.
 */

import { test } from "@playwright/test";
import path from "node:path";

const OUT_DIR = path.resolve(
  __dirname,
  "../../zetas_design_system_handoff/mobile-screens",
);
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const out = (name: string) => path.join(OUT_DIR, `${name}.png`);

test.describe("Handoff capture — authenticated", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  async function goAndShoot(page: any, url: string, file: string) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    // Let any lazy widgets settle
    await page.waitForTimeout(600);
    await page.screenshot({ path: out(file), fullPage: true });
  }

  test("01-dashboard", async ({ page }) => {
    await goAndShoot(page, "/dashboard", "01-dashboard");
  });

  test("02-transactions", async ({ page }) => {
    await goAndShoot(page, "/transactions", "02-transactions");
  });

  test("03-transaction-detail", async ({ page }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    const firstRow = page.locator("[aria-expanded]").first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: out("03-transaction-detail"), fullPage: true });
  });

  test("04-categorizar", async ({ page }) => {
    await goAndShoot(page, "/categorizar", "04-categorizar");
  });

  test("05-destinatarios", async ({ page }) => {
    await goAndShoot(page, "/destinatarios", "05-destinatarios");
  });

  test("06-import", async ({ page }) => {
    await goAndShoot(page, "/import", "06-import");
  });

  test("07-accounts", async ({ page }) => {
    await goAndShoot(page, "/accounts", "07-accounts");
  });

  test("08-account-detail", async ({ page }) => {
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    // First account card with an href
    const firstAccount = page.locator('a[href^="/accounts/"]').first();
    if (await firstAccount.isVisible().catch(() => false)) {
      await firstAccount.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: out("08-account-detail"), fullPage: true });
  });

  test("09-deudas", async ({ page }) => {
    await goAndShoot(page, "/deudas", "09-deudas");
  });

  test("10-deuda-planificador", async ({ page }) => {
    await goAndShoot(page, "/deudas/planificador", "10-deuda-planificador");
  });

  test("11-recurrentes", async ({ page }) => {
    await goAndShoot(page, "/recurrentes", "11-recurrentes");
  });

  test("12-presupuesto", async ({ page }) => {
    await goAndShoot(page, "/presupuesto", "12-presupuesto");
  });

  test("13-gestionar", async ({ page }) => {
    await goAndShoot(page, "/gestionar", "13-gestionar");
  });

  test("14-settings", async ({ page }) => {
    await goAndShoot(page, "/settings", "14-settings");
  });

  test("15-settings-analytics", async ({ page }) => {
    await goAndShoot(page, "/settings/analytics", "15-settings-analytics");
  });
});

test.describe("Handoff capture — unauthenticated", () => {
  test.use({ viewport: MOBILE_VIEWPORT, storageState: { cookies: [], origins: [] } });

  async function goAndShoot(page: any, url: string, file: string) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await page.screenshot({ path: out(file), fullPage: true });
  }

  test("16-login", async ({ page }) => {
    await goAndShoot(page, "/login", "16-login");
  });

  test("17-signup", async ({ page }) => {
    await goAndShoot(page, "/signup", "17-signup");
  });

  test("18-forgot-password", async ({ page }) => {
    await goAndShoot(page, "/forgot-password", "18-forgot-password");
  });
});
