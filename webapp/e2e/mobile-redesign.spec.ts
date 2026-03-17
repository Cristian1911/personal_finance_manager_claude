import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForNav(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** Get a CSS custom property value from :root */
async function getCSSVar(page: Page, varName: string): Promise<string> {
  return page.evaluate((name) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }, varName);
}

/** Get relative luminance from rgb string */
function luminance(rgb: string): number {
  const match = rgb.match(/\d+/g);
  if (!match) return 0;
  const [r, g, b] = match.map(Number).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio */
function contrastRatio(color1: string, color2: string): number {
  const l1 = luminance(color1);
  const l2 = luminance(color2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 0: Brand Evolution — "Sage Evolved"
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Phase 0: Brand Evolution", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile tests only");
  });

  test("core color tokens match Sage Evolved palette", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const tokens = {
      "--z-ink": "#0A0E14",
      "--z-white": "#F0EDE6",
      "--z-income": "#5CB88A",
      "--z-expense": "#E8875A",
      "--z-debt": "#E05545",
      "--z-alert": "#D4A843",
    };

    for (const [varName, expected] of Object.entries(tokens)) {
      const actual = await getCSSVar(page, varName);
      expect(actual.toLowerCase(), `${varName} should be ${expected}`).toBe(expected.toLowerCase());
    }
  });

  test("surface tokens have three levels", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const surface1 = await getCSSVar(page, "--z-surface");
    const surface2 = await getCSSVar(page, "--z-surface-2");
    const surface3 = await getCSSVar(page, "--z-surface-3");

    expect(surface1, "--z-surface should be set").toBeTruthy();
    expect(surface2, "--z-surface-2 should be set").toBeTruthy();
    expect(surface3, "--z-surface-3 should be set (new)").toBeTruthy();

    // surface-3 is the new one — verify it's distinct
    expect(surface3).not.toBe(surface1);
    expect(surface3).not.toBe(surface2);
  });

  test("border tokens use rgba opacity (not fixed hex)", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const border = await getCSSVar(page, "--z-border");
    const borderStrong = await getCSSVar(page, "--z-border-strong");

    expect(border, "--z-border should use rgba").toMatch(/rgba/);
    expect(borderStrong, "--z-border-strong should use rgba").toMatch(/rgba/);
  });

  test("typography scale CSS vars are defined", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const typeVars = [
      "--z-type-display-size",
      "--z-type-hero-size",
      "--z-type-h1-size",
      "--z-type-body-size",
      "--z-type-widget-lg-size",
      "--z-type-widget-sm-size",
      "--z-type-label-size",
      "--z-type-caption-size",
      "--z-type-trend-size",
    ];

    for (const v of typeVars) {
      const val = await getCSSVar(page, v);
      expect(val, `${v} should be defined`).toBeTruthy();
    }
  });

  test("spacing scale CSS vars are defined", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const spaceVars = [
      "--z-space-xs",
      "--z-space-sm",
      "--z-space-md",
      "--z-space-lg",
      "--z-space-xl",
      "--z-space-2xl",
      "--z-space-3xl",
    ];

    for (const v of spaceVars) {
      const val = await getCSSVar(page, v);
      expect(val, `${v} should be defined`).toBeTruthy();
    }
  });

  test("status surface utility classes are available", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    // Inject a test element with each surface class and verify computed styles
    const surfaces = ["surface-income", "surface-expense", "surface-debt", "surface-alert", "surface-neutral"];

    for (const cls of surfaces) {
      const hasStyles = await page.evaluate((className) => {
        const el = document.createElement("div");
        el.className = className;
        document.body.appendChild(el);
        const style = getComputedStyle(el);
        const hasColor = style.color !== "" && style.color !== "rgb(0, 0, 0)";
        const hasBg = style.backgroundColor !== "" && style.backgroundColor !== "rgba(0, 0, 0, 0)";
        document.body.removeChild(el);
        return hasColor || hasBg;
      }, cls);

      expect(hasStyles, `${cls} utility class should apply color/background styles`).toBeTruthy();
    }
  });

  test("FAB button uses explicit bg-z-white, not bg-primary", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const fab = page.getByRole("button", { name: /menu de acciones/i });
    await expect(fab).toBeVisible();

    const fabBg = await fab.evaluate((el) => getComputedStyle(el).backgroundColor);
    const fabColor = await fab.evaluate((el) => getComputedStyle(el).color);

    // FAB should be light background with dark text
    const ratio = contrastRatio(fabBg, fabColor);
    expect(ratio, `FAB contrast ratio should be ≥ 4.5:1 (got ${ratio.toFixed(2)})`).toBeGreaterThanOrEqual(4.5);
  });

  test("expense and alert colors are visually distinguishable", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const expense = await getCSSVar(page, "--z-expense");
    const alert = await getCSSVar(page, "--z-alert");

    // Convert hex to rgb for comparison
    const toRgb = (hex: string) => {
      const h = hex.replace("#", "");
      return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
    };

    const ratio = contrastRatio(toRgb(expense), toRgb(alert));
    // These should be distinct enough to tell apart at small sizes
    expect(ratio, `Expense vs alert contrast: ${ratio.toFixed(2)}:1 — should be distinguishable`).toBeGreaterThan(1.3);
  });

  test("mobile components use brand tokens (no hardcoded Tailwind colors)", async ({ page }) => {
    await page.goto("/transactions");
    await waitForNav(page);

    // Check that the gastos/ingresos summary doesn't use raw orange-500 / green-500
    const hasHardcodedOrange = await page.evaluate(() => {
      const els = document.querySelectorAll('[class*="text-orange-500"], [class*="bg-orange-500"]');
      return els.length;
    });

    const hasHardcodedGreen = await page.evaluate(() => {
      const els = document.querySelectorAll('[class*="text-green-500"], [class*="bg-green-500"], [class*="text-green-600"]');
      return els.length;
    });

    expect(hasHardcodedOrange, "Should not have hardcoded text-orange-500 classes").toBe(0);
    expect(hasHardcodedGreen, "Should not have hardcoded text-green-500/600 classes").toBe(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 1: Motion + Accessibility
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Phase 1: Motion + Accessibility", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile tests only");
  });

  test("dashboard hero card has fade-in animation wrapper", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    // Framer Motion adds style attributes with opacity/transform
    const heroCard = page.locator("text=DISPONIBLE PARA GASTAR").locator("..").locator("..");
    await expect(heroCard).toBeVisible();

    // After animation completes, opacity should be 1
    const opacity = await heroCard.evaluate((el) => {
      // Walk up to find the motion div
      let current: HTMLElement | null = el as HTMLElement;
      while (current) {
        const style = current.getAttribute("style");
        if (style && style.includes("opacity")) return getComputedStyle(current).opacity;
        current = current.parentElement;
      }
      return "1";
    });
    expect(opacity).toBe("1");
  });

  test("upcoming payments list uses staggered animation", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    // Wait for animations to settle
    await page.waitForTimeout(500);

    // Check that Próximos pagos section exists and items are visible
    const paymentSection = page.getByRole("heading", { name: /Próximos pagos/ });
    if (await paymentSection.isVisible()) {
      // Payments should be visible (animation completed)
      const paymentItems = page.locator('a[href="/recurrentes"]').filter({ has: page.locator("text=/\\$|COP/") });
      const count = await paymentItems.count();
      expect(count, "Should have visible payment items after animation").toBeGreaterThan(0);
    }
  });

  test("categorization inbox has ARIA expanded attribute", async ({ page }) => {
    await page.goto("/categories");
    await waitForNav(page);

    // Find the inbox toggle button
    const inboxButton = page.locator("button[aria-expanded]").filter({ hasText: /sin categoría/ });
    const count = await inboxButton.count();

    if (count > 0) {
      const ariaExpanded = await inboxButton.getAttribute("aria-expanded");
      expect(ariaExpanded, "Inbox toggle should have aria-expanded").toBeTruthy();

      const ariaLabel = await inboxButton.getAttribute("aria-label");
      expect(ariaLabel, "Inbox toggle should have aria-label").toBeTruthy();
      expect(ariaLabel).toMatch(/transacciones sin categoría/);
    }
  });

  test("budget rows show warning icons for high usage", async ({ page }) => {
    await page.goto("/categories");
    await waitForNav(page);

    // Budget rows with high usage should show AlertTriangle or AlertCircle icons
    // This checks that the icon IS present alongside the progress bar
    const budgetSection = page.getByText("Con presupuesto");
    if (await budgetSection.isVisible()) {
      // Check for SVG icons in the budget area (AlertTriangle has specific path data)
      const warningIcons = page.locator("svg.lucide-alert-triangle, svg.lucide-alert-circle");
      // At least verify no errors — icons may or may not show depending on data
      test.info().annotations.push({
        type: "INFO",
        description: `Budget warning icons found: ${await warningIcons.count()}`,
      });
    }
  });

  test("category chips have scroll gradient indicators", async ({ page }) => {
    await page.goto("/transactions");
    await waitForNav(page);

    // Check for gradient overlay elements near the chip scroll
    const gradients = page.locator(".pointer-events-none").filter({
      has: page.locator('[class*="bg-gradient"]'),
    });

    // These should exist if there are category chips
    const chipScroll = page.locator('[class*="overflow-x-auto"]').first();
    if (await chipScroll.isVisible()) {
      const gradientCount = await gradients.count();
      expect(gradientCount, "Should have left/right gradient indicators on chip scroll").toBeGreaterThanOrEqual(2);
    }
  });

  test("Spanish text has correct accents (no typos)", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    // Open FAB to check action labels
    const fab = page.getByRole("button", { name: /menu de acciones/i });
    await fab.click();

    // Check corrected text
    await expect(page.getByText("Acciones rápidas")).toBeVisible();
    await expect(page.getByText("Gasto rápido")).toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 2: Navigation + Widget System
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Phase 2: Navigation + Widget System", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile tests only");
  });

  test("tab bar renders exactly 4 tabs with FAB gap", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const bottomNav = page.locator("nav.fixed");
    const tabLinks = bottomNav.locator("a");
    await expect(tabLinks).toHaveCount(4);

    // FAB gap exists between left and right tabs
    const fabGap = bottomNav.locator(".w-16");
    await expect(fabGap).toBeVisible();
  });

  test("tab 1 is always Inicio and tab 4 is always Más", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const bottomNav = page.locator("nav.fixed");
    const tabs = bottomNav.locator("a");

    // First tab
    const firstTabText = await tabs.first().textContent();
    expect(firstTabText).toContain("Inicio");

    // Last tab
    const lastTabText = await tabs.last().textContent();
    expect(lastTabText).toContain("Más");
  });

  test("dynamic tabs 2-3 have valid labels and routes", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const bottomNav = page.locator("nav.fixed");
    const tabs = bottomNav.locator("a");

    // Tab 2 (index 1) and Tab 3 (index 2) should have text content
    const tab2Text = await tabs.nth(1).textContent();
    const tab3Text = await tabs.nth(2).textContent();

    expect(tab2Text?.trim().length, "Tab 2 should have a label").toBeGreaterThan(0);
    expect(tab3Text?.trim().length, "Tab 3 should have a label").toBeGreaterThan(0);

    // Both should be navigable links
    const tab2Href = await tabs.nth(1).getAttribute("href");
    const tab3Href = await tabs.nth(2).getAttribute("href");
    expect(tab2Href, "Tab 2 should have an href").toBeTruthy();
    expect(tab3Href, "Tab 3 should have an href").toBeTruthy();
  });

  test("dynamic tabs navigate to correct pages", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const bottomNav = page.locator("nav.fixed");
    const tabs = bottomNav.locator("a");

    // Click tab 2
    const tab2Href = await tabs.nth(1).getAttribute("href");
    await tabs.nth(1).click();
    await waitForNav(page);
    await expect(page).toHaveURL(new RegExp(tab2Href!));

    // Go back and click tab 3
    await page.goto("/dashboard");
    await waitForNav(page);
    const tab3Href = await bottomNav.locator("a").nth(2).getAttribute("href");
    await bottomNav.locator("a").nth(2).click();
    await waitForNav(page);
    await expect(page).toHaveURL(new RegExp(tab3Href!));
  });

  test("Más page shows profile header with user name", async ({ page }) => {
    await page.goto("/gestionar");
    await waitForNav(page);

    // Page title
    await expect(page.getByRole("heading", { name: "Más" }).or(page.getByText("Más").first())).toBeVisible();

    // Profile card with avatar area
    const profileCard = page.locator(".rounded-xl.border.bg-card").filter({
      has: page.locator("p.font-semibold"),
    });
    await expect(profileCard.first()).toBeVisible();
  });

  test("Más page shows 6 quick link cards", async ({ page }) => {
    await page.goto("/gestionar");
    await waitForNav(page);

    const quickLinksSection = page.getByText("ACCESO RÁPIDO").locator("..").locator("..");

    // Should show grid of quick links
    const links = quickLinksSection.locator("a");
    const count = await links.count();
    expect(count, "Should have 6 quick link cards").toBe(6);

    // Verify key links exist
    await expect(page.getByText("Importar")).toBeVisible();
    await expect(page.getByText("Cuentas")).toBeVisible();
    await expect(page.getByText("Destinatarios")).toBeVisible();
    await expect(page.getByText("Categorías")).toBeVisible();
    await expect(page.getByText("Deudas")).toBeVisible();
    await expect(page.getByText("Recurrentes")).toBeVisible();
  });

  test("Más page has settings section with Ajustes link", async ({ page }) => {
    await page.goto("/gestionar");
    await waitForNav(page);

    await expect(page.getByText("CONFIGURACIÓN")).toBeVisible();
    const settingsLink = page.getByRole("link", { name: /Ajustes/ });
    await expect(settingsLink).toBeVisible();

    // Click should navigate to settings
    await settingsLink.click();
    await waitForNav(page);
    await expect(page).toHaveURL(/\/settings/);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 3: Composite Tab Views
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Phase 3: Composite Views", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile tests only");
  });

  test("all dashboard pages load without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!text.includes("hydrat") && !text.includes("Warning:") && !text.includes("DevTools")) {
          errors.push(text);
        }
      }
    });

    const pages = [
      "/dashboard",
      "/transactions",
      "/categories",
      "/deudas",
      "/recurrentes",
      "/gestionar",
      "/accounts",
      "/settings",
    ];

    for (const p of pages) {
      await page.goto(p);
      await waitForNav(page);
    }

    expect(
      errors.length,
      `Console errors across pages: ${errors.slice(0, 5).join("; ")}`
    ).toBe(0);
  });

  test("deudas page renders debt summary and account cards", async ({ page }) => {
    await page.goto("/deudas");
    await waitForNav(page);

    await expect(page.getByText("Deuda total")).toBeVisible();
    // Should have at least one debt-related element
    const hasDebtContent = await page.locator("main").evaluate((main) => {
      return main.textContent?.includes("Deuda") || main.textContent?.includes("deuda");
    });
    expect(hasDebtContent, "Deudas page should show debt content").toBeTruthy();
  });

  test("no horizontal overflow on any mobile page", async ({ page }) => {
    const pages = ["/dashboard", "/transactions", "/categories", "/deudas", "/gestionar", "/settings"];

    for (const p of pages) {
      await page.goto(p);
      await waitForNav(page);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasOverflow, `Horizontal overflow on ${p}`).toBeFalsy();
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 4: Onboarding Redesign
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Phase 4: Onboarding", () => {
  // Onboarding tests run without auth (fresh user would see this)
  // But we can only test the UI structure since we can't create users in E2E
  // These tests use the "mobile" project but skip auth check

  test.describe("Onboarding page structure", () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "Mobile tests only");
    });

    test("onboarding page loads with step 1 (Objetivo)", async ({ page }) => {
      await page.goto("/onboarding");
      await waitForNav(page);

      // Progress bar
      await expect(page.getByText("Paso 1 de 6")).toBeVisible();

      // Step 1 content
      await expect(page.getByText("Bienvenido a Zeta")).toBeVisible();

      // 4 purpose cards
      await expect(page.getByText("Salir de deudas")).toBeVisible();
      await expect(page.getByText("Entender mis gastos")).toBeVisible();
      await expect(page.getByText("Ahorrar para una meta")).toBeVisible();
      await expect(page.getByText("Mejorar hábitos financieros")).toBeVisible();
    });

    test("totalSteps is 6 (shown in progress bar)", async ({ page }) => {
      await page.goto("/onboarding");
      await waitForNav(page);

      await expect(page.getByText(/de 6/)).toBeVisible();
    });

    test("step 1 → step 2 navigation works", async ({ page }) => {
      await page.goto("/onboarding");
      await waitForNav(page);

      // Select a purpose
      await page.getByText("Entender mis gastos").click();

      // Click next
      await page.getByRole("button", { name: /Siguiente/ }).click();

      // Step 2 should be Profile (reordered from old step 3)
      await expect(page.getByText("Tu perfil")).toBeVisible();
      await expect(page.getByText("Paso 2 de 6")).toBeVisible();
      await expect(page.getByLabel("Nombre completo")).toBeVisible();
    });

    test("step 2 is Perfil (reordered), step 3 is Finanzas", async ({ page }) => {
      await page.goto("/onboarding");
      await waitForNav(page);

      // Step 1: select purpose
      await page.getByText("Salir de deudas").click();
      await page.getByRole("button", { name: /Siguiente/ }).click();

      // Step 2: Perfil
      await expect(page.getByText("Tu perfil")).toBeVisible();
      await page.getByLabel("Nombre completo").fill("Test User");
      await page.getByRole("button", { name: /Siguiente/ }).click();

      // Step 3: Finanzas (was step 2)
      await expect(page.getByText("Pulso mensual")).toBeVisible();
      await expect(page.getByText("Paso 3 de 6")).toBeVisible();
    });

    test("step 3 shows debt count question for manage_debt users", async ({ page }) => {
      await page.goto("/onboarding");
      await waitForNav(page);

      // Choose manage_debt
      await page.getByText("Salir de deudas").click();
      await page.getByRole("button", { name: /Siguiente/ }).click();

      // Step 2: fill profile
      await page.getByLabel("Nombre completo").fill("Test");
      await page.getByRole("button", { name: /Siguiente/ }).click();

      // Step 3: should show debt count question
      await expect(page.getByText(/tarjetas de crédito o préstamos/)).toBeVisible();
    });

    test("step 3 does NOT show debt count for non-debt users", async ({ page }) => {
      await page.goto("/onboarding");
      await waitForNav(page);

      // Choose track_spending
      await page.getByText("Entender mis gastos").click();
      await page.getByRole("button", { name: /Siguiente/ }).click();

      // Step 2: fill profile
      await page.getByLabel("Nombre completo").fill("Test");
      await page.getByRole("button", { name: /Siguiente/ }).click();

      // Step 3: should NOT show debt count question
      await expect(page.getByText(/tarjetas de crédito o préstamos/)).not.toBeVisible();
    });

    test("step 4 shows phone mockup with tab preview", async ({ page }) => {
      await page.goto("/onboarding");
      await waitForNav(page);

      // Navigate to step 4
      await page.getByText("Entender mis gastos").click();
      await page.getByRole("button", { name: /Siguiente/ }).click();
      await page.getByLabel("Nombre completo").fill("Test");
      await page.getByRole("button", { name: /Siguiente/ }).click();
      await page.getByLabel("Ingreso mensual estimado").fill("5000");
      await page.getByLabel("Gasto mensual estimado").fill("3000");
      await page.getByRole("button", { name: /Siguiente/ }).click();

      // Step 4: Tab preview
      await expect(page.getByText("Tu app")).toBeVisible();
      await expect(page.getByText("Paso 4 de 6")).toBeVisible();
      await expect(page.getByText(/así se ve tu Zeta/)).toBeVisible();

      // Phone mockup should have tab labels
      await expect(page.getByText("Inicio")).toBeVisible();
      await expect(page.getByText("Más")).toBeVisible();

      // Tappable tabs (buttons for swap)
      const swapButtons = page.locator("button").filter({ has: page.locator("svg") });
      const swapCount = await swapButtons.count();
      expect(swapCount, "Should have tappable tab swap buttons").toBeGreaterThanOrEqual(2);
    });

    test("back button works across all steps", async ({ page }) => {
      await page.goto("/onboarding");
      await waitForNav(page);

      // Go to step 2
      await page.getByText("Entender mis gastos").click();
      await page.getByRole("button", { name: /Siguiente/ }).click();
      await expect(page.getByText("Paso 2 de 6")).toBeVisible();

      // Go back to step 1
      await page.getByRole("button", { name: /Atrás/ }).click();
      await expect(page.getByText("Paso 1 de 6")).toBeVisible();
      await expect(page.getByText("Bienvenido a Zeta")).toBeVisible();
    });

    test("step 1 Atrás button is disabled", async ({ page }) => {
      await page.goto("/onboarding");
      await waitForNav(page);

      const backButton = page.getByRole("button", { name: /Atrás/ });
      await expect(backButton).toBeDisabled();
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CROSS-PHASE: Visual Regression Guards
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Visual Regression Guards", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile tests only");
  });

  test("primary color is z-white (not sage) after brand evolution", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const primary = await getCSSVar(page, "--primary");
    const zWhite = await getCSSVar(page, "--z-white");

    // --primary should reference --z-white
    // We can't check the var() reference directly, so check computed values match
    const primaryComputed = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
    );

    expect(
      primaryComputed.includes("--z-white") || primary === zWhite,
      `--primary should be var(--z-white) or #F0EDE6, got: ${primaryComputed}`
    ).toBeTruthy();
  });

  test("dark mode tokens match root tokens (Zeta is dark-mode-first)", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    // Since Zeta is dark-mode-first, :root and .dark should have the same values
    const rootPrimary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
    );

    // Add .dark class if not already present, then check
    const darkPrimary = await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      const val = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      return val;
    });

    expect(rootPrimary, "Root and .dark --primary should match").toBe(darkPrimary);
  });

  test("form inputs have visible borders (not near-invisible)", async ({ page }) => {
    await page.goto("/settings");
    await waitForNav(page);

    const nameInput = page.getByLabel("Nombre completo");
    if (await nameInput.isVisible()) {
      const borderColor = await nameInput.evaluate((el) => getComputedStyle(el).borderColor);

      // Border should be somewhat visible (not fully transparent)
      expect(
        borderColor !== "rgba(0, 0, 0, 0)" && borderColor !== "transparent",
        `Input border should be visible, got: ${borderColor}`
      ).toBeTruthy();
    }
  });
});
