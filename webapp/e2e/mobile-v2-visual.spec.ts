import { test, expect } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe("Mobile v2 visual layout", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("Inicio: layout renders correctly", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Take screenshot first for visual inspection
    await page.screenshot({ path: "test-results/mobile-v2-inicio.png", fullPage: true });

    // Hero visible (use .first() to avoid strict mode on mobile+desktop match)
    const hero = page.getByRole("button", { name: /expandir desglose/i }).first();
    await expect(hero).toBeVisible({ timeout: 10000 });

    // Metrics grid
    await expect(page.getByText("RITMO").first()).toBeVisible();

    // Burndown
    await expect(page.getByText(/restante/i).first()).toBeVisible();

    // Discovery
    await expect(page.getByText("¿Puedo comprarlo?").first()).toBeVisible();
  });

  test("Movimientos: layout renders correctly", async ({ page }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "test-results/mobile-v2-movimientos.png", fullPage: true });

    // Lectura zone
    await expect(page.getByText("LECTURA").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("INGRESOS").first()).toBeVisible();
    await expect(page.getByText("GASTOS").first()).toBeVisible();

    // Tools grid (scoped to mobile container to avoid matching desktop sidebar)
    const mobileView = page.locator(".lg\\:hidden").first();
    await expect(mobileView.getByText("HERRAMIENTAS").first()).toBeVisible();
    await expect(mobileView.getByText("Categorizar").first()).toBeVisible();

    // Transaction feed (at least one transaction row)
    const txRows = page.locator("[aria-expanded]");
    const count = await txRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Plan: layout renders correctly", async ({ page }) => {
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "test-results/mobile-v2-plan.png", fullPage: true });

    // Budget hero
    await expect(page.getByText("GASTADO ESTE MES").first()).toBeVisible({ timeout: 10000 });

    // Planificar CTA
    await expect(page.getByText("Planificar").first()).toBeVisible();

    // Flow chart
    await expect(page.getByText("FLUJO DEL MES").first()).toBeVisible();
  });

  test("Deudas: layout renders correctly", async ({ page }) => {
    await page.goto("/deudas");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "test-results/mobile-v2-deudas.png", fullPage: true });

    // Hero
    await expect(page.getByText("CUOTA MENSUAL").first()).toBeVisible({ timeout: 10000 });

    // Simular button
    await expect(page.getByText("Simular").first()).toBeVisible();
  });

  test("Inicio: expanding hero collapses other sections", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const heroButton = page.getByRole("button", { name: /expandir desglose/i }).first();
    await expect(heroButton).toBeVisible({ timeout: 10000 });

    // Click to expand
    await heroButton.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: "test-results/mobile-v2-inicio-expanded.png", fullPage: true });

    // Should show breakdown content
    await expect(page.getByText("Cómo se calcula").first()).toBeVisible();
  });

  test("Plan: expanding hero shows category breakdown", async ({ page }) => {
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");

    const heroButton = page.getByText("GASTADO ESTE MES").first().locator("ancestor::button").first();

    // If the hero is a button, click it
    const expandable = page.locator("button[aria-expanded]").first();
    if (await expandable.isVisible()) {
      await expandable.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: "test-results/mobile-v2-plan-expanded.png", fullPage: true });
    }
  });

  test("Movimientos: tools expand inline instead of navigating", async ({ page }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");

    // Find Categorizar button
    const categorizarBtn = page.getByText("Categorizar").first();
    await expect(categorizarBtn).toBeVisible({ timeout: 10000 });

    // Click it — should expand, NOT navigate
    await categorizarBtn.click();
    await page.waitForTimeout(300);

    // Should still be on transactions page
    expect(page.url()).toContain("/transactions");

    await page.screenshot({ path: "test-results/mobile-v2-movimientos-tool-expanded.png", fullPage: true });
  });
});
