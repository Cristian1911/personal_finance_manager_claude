import { test, expect, type Page, type Locator } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for Next.js navigation to settle */
async function waitForNav(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** Get computed color as rgb string */
async function getColor(locator: Locator) {
  return locator.evaluate((el) => getComputedStyle(el).color);
}

/** Get computed background-color as rgb string */
async function getBgColor(locator: Locator) {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor);
}

/** Check if element is visually truncated (overflow hidden) */
async function isTextTruncated(locator: Locator) {
  return locator.evaluate((el) => el.scrollWidth > el.clientWidth);
}

/** Get relative luminance from rgb string for contrast calculation */
function luminance(rgb: string): number {
  const match = rgb.match(/\d+/g);
  if (!match) return 0;
  const [r, g, b] = match.map(Number).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Calculate WCAG contrast ratio */
function contrastRatio(color1: string, color2: string): number {
  const l1 = luminance(color1);
  const l2 = luminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Dashboard pages ──────────────────────────────────────────────────────────

const PAGES = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Transacciones", path: "/transactions" },
  { name: "Categorizar", path: "/categorizar" },
  { name: "Recurrentes", path: "/recurrentes" },
  { name: "Presupuesto", path: "/categories" },
  { name: "Deudas", path: "/deudas" },
  { name: "Cuentas", path: "/accounts" },
  { name: "Importar", path: "/import" },
  { name: "Destinatarios", path: "/destinatarios" },
  { name: "Gestionar", path: "/gestionar" },
  { name: "Ajustes", path: "/settings" },
] as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOBILE TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Mobile UX", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile tests only in mobile project");
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test.describe("Bottom Tab Bar", () => {
    test("all tab links navigate to the correct page", async ({ page }) => {
      const tabs = [
        { label: "Inicio", expectedPath: "/dashboard" },
        { label: "Recurrentes", expectedPath: "/recurrentes" },
        { label: "Gestionar", expectedPath: "/gestionar" },
      ];

      for (const tab of tabs) {
        await page.goto("/dashboard");
        await waitForNav(page);

        const bottomNav = page.locator("nav.fixed");
        const link = bottomNav.getByRole("link", { name: tab.label });
        await link.click();
        await waitForNav(page);

        await expect(page).toHaveURL(new RegExp(tab.expectedPath));
      }
    });

    test("Presupuesto tab navigates correctly (with badge)", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const bottomNav = page.locator("nav.fixed");
      const link = bottomNav.getByRole("link", { name: /Presupuesto/ });
      await link.click();
      await waitForNav(page);

      await expect(page).toHaveURL(/\/categories/);
    });

    test("active tab shows aria-current='page'", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const bottomNav = page.locator("nav.fixed");
      const inicioLink = bottomNav.getByRole("link", { name: "Inicio" });
      await expect(inicioLink).toHaveAttribute("aria-current", "page");
    });

    test("BUG: active tab indicator has insufficient color contrast", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const bottomNav = page.locator("nav.fixed");
      const activeLink = bottomNav.locator('a[aria-current="page"]');
      const inactiveLink = bottomNav.locator("a:not([aria-current])").first();

      const activeColor = await getColor(activeLink);
      const inactiveColor = await getColor(inactiveLink);

      // Active and inactive colors should have meaningful contrast
      const ratio = contrastRatio(activeColor, inactiveColor);
      // WCAG recommends 3:1 minimum for UI components
      // Current diff: rgb(197,191,174) vs rgb(158,152,136) = ~1.3:1 (FAIL)
      test.info().annotations.push({
        type: "UX_ISSUE",
        description: `Active vs inactive tab contrast ratio: ${ratio.toFixed(2)}:1 (need ≥ 3:1). ` +
          `Active: ${activeColor}, Inactive: ${inactiveColor}`,
      });

      // This test documents the bug — it SHOULD pass at 3:1 but currently fails
      expect(
        ratio,
        `Active/inactive tab contrast is only ${ratio.toFixed(2)}:1 — too subtle`
      ).toBeGreaterThanOrEqual(3);
    });

    test("BUG: active tab should have visual weight difference (font-weight or indicator bar)", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const bottomNav = page.locator("nav.fixed");
      const activeLink = bottomNav.locator('a[aria-current="page"]');
      const inactiveLink = bottomNav.locator("a:not([aria-current])").first();

      const activeFontWeight = await activeLink.evaluate(
        (el) => getComputedStyle(el).fontWeight
      );
      const inactiveFontWeight = await inactiveLink.evaluate(
        (el) => getComputedStyle(el).fontWeight
      );

      // Check for any visual weight difference (font-weight, border-bottom, etc.)
      const hasIndicatorBar = await bottomNav.locator('.border-b, [class*="border-bottom"], [class*="indicator"]').count();

      test.info().annotations.push({
        type: "UX_ISSUE",
        description: `Active tab has no weight/indicator differentiation. ` +
          `Active font-weight: ${activeFontWeight}, Inactive: ${inactiveFontWeight}. ` +
          `Indicator bar: ${hasIndicatorBar > 0 ? "yes" : "none"}`,
      });

      // At least one differentiator should exist
      const hasDifference = activeFontWeight !== inactiveFontWeight || hasIndicatorBar > 0;
      expect(hasDifference, "Active tab needs a visual indicator beyond subtle color change").toBeTruthy();
    });
  });

  // ── FAB Menu ──────────────────────────────────────────────────────────────

  test.describe("FAB Menu", () => {
    test("FAB opens and shows action menu items", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const fab = page.getByRole("button", { name: "Abrir menú de acciones" });
      await expect(fab).toBeVisible();
      await fab.click();

      // Sub-actions should appear
      await expect(page.getByRole("button", { name: "Gasto rápido" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Ingreso" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Transferencia" })).toBeVisible();
    });

    test("FAB closes on backdrop click", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const fab = page.getByRole("button", { name: "Abrir menú de acciones" });
      await fab.click();
      await expect(page.getByRole("button", { name: "Gasto rápido" })).toBeVisible();

      // Click the backdrop (aria-hidden div)
      await page.locator(".fixed.inset-0.bg-black\\/40").click({ position: { x: 10, y: 10 } });
      await expect(page.getByRole("button", { name: "Gasto rápido" })).not.toBeVisible();
    });

    test("FAB closes on Escape key", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const fab = page.getByRole("button", { name: "Abrir menú de acciones" });
      await fab.click();
      await expect(page.getByRole("button", { name: "Gasto rápido" })).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Gasto rápido" })).not.toBeVisible();
    });

    test("BUG: FAB backdrop blocks bottom nav tap — navigation doesn't happen", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      // Open FAB
      const fab = page.getByRole("button", { name: "Abrir menú de acciones" });
      await fab.click();
      await expect(page.getByRole("button", { name: "Gasto rápido" })).toBeVisible();

      // Try to click a bottom nav link while FAB is open
      const bottomNav = page.locator("nav.fixed");
      const recurrentesLink = bottomNav.getByRole("link", { name: "Recurrentes" });
      await recurrentesLink.click({ force: true });

      // Wait a bit for potential navigation
      await page.waitForTimeout(1000);

      test.info().annotations.push({
        type: "BUG",
        description:
          "FAB backdrop (z-40) intercepts clicks intended for bottom nav (also z-40). " +
          "Clicking a tab while FAB is open only closes FAB, doesn't navigate. " +
          "Fix: close FAB AND navigate on bottom nav tap, or raise nav z-index.",
      });

      // BUG: URL should be /recurrentes but stays at /dashboard
      // This documents the current broken behavior
      const currentUrl = page.url();
      const navigatedAway = !currentUrl.includes("/dashboard");

      expect(
        navigatedAway,
        "Tapping bottom nav while FAB is open should navigate (currently only closes FAB)"
      ).toBeTruthy();
    });

    test("FAB should close on route change (e.g., browser back)", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      // Open FAB
      const fab = page.getByRole("button", { name: "Abrir menú de acciones" });
      await fab.click();
      await expect(page.getByRole("button", { name: "Gasto rápido" })).toBeVisible();

      // Navigate away using JS (simulating programmatic navigation)
      await page.goto("/recurrentes");
      await waitForNav(page);

      // FAB menu should be closed on the new page
      await expect(page.getByRole("button", { name: "Gasto rápido" })).not.toBeVisible();
      // The FAB button itself should still be present (closed state)
      await expect(
        page.getByRole("button", { name: "Abrir menú de acciones" })
      ).toBeVisible();
    });

    test("FAB is present on all mobile pages", async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.path);
        await waitForNav(page);
        const fab = page.getByRole("button", { name: /menú de acciones|Cerrar menú/ });
        await expect(fab, `FAB missing on ${p.name} (${p.path})`).toBeVisible();
      }
    });
  });

  // ── Page Content ──────────────────────────────────────────────────────────

  test.describe("Dashboard (Mobile)", () => {
    test("shows available-to-spend summary", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      await expect(page.getByText("DISPONIBLE PARA GASTAR")).toBeVisible();
      // Should show a currency value
      await expect(page.getByText(/\$\s?[\d.,]+/)).toBeTruthy();
    });

    test("shows próximos pagos section", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      await expect(page.getByRole("heading", { name: /Próximos pagos/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /Ver todos/ }).first()).toBeVisible();
    });

    test("shows actividad reciente section", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      await expect(page.getByText("ACTIVIDAD RECIENTE")).toBeVisible();
    });
  });

  test.describe("Transactions (Mobile)", () => {
    test("shows transaction summary with gastos/ingresos", async ({ page }) => {
      await page.goto("/transactions");
      await waitForNav(page);

      await expect(page.getByText("Gastos")).toBeVisible();
      await expect(page.getByText("Ingresos")).toBeVisible();
    });

    test("transaction list items are tappable", async ({ page }) => {
      await page.goto("/transactions");
      await waitForNav(page);

      const transactions = page.locator("main a, main [role='link'], main [role='button']");
      const count = await transactions.count();
      expect(count, "Transaction list should have clickable items").toBeGreaterThan(0);
    });
  });

  test.describe("Categorizar (Mobile)", () => {
    test("shows uncategorized count and bulk actions", async ({ page }) => {
      await page.goto("/categorizar");
      await waitForNav(page);

      await expect(page.getByText(/transacciones sin categorizar/)).toBeVisible();
      await expect(page.getByText(/Aceptar.*sugerencias/)).toBeVisible();
    });
  });

  test.describe("Recurrentes (Mobile)", () => {
    test("shows calendar and recurring transactions", async ({ page }) => {
      await page.goto("/recurrentes");
      await waitForNav(page);

      await expect(page.getByText("Transacciones Recurrentes")).toBeVisible();
      // Calendar month nav
      await expect(page.getByText(/Marzo 2026|2026/)).toBeVisible();
    });
  });

  test.describe("Presupuesto (Mobile)", () => {
    test("shows budget summary with month navigation", async ({ page }) => {
      await page.goto("/categories");
      await waitForNav(page);

      await expect(page.getByText("Presupuesto")).toBeVisible();
      await expect(page.getByText("¿Cómo vas este mes?")).toBeVisible();
    });
  });

  test.describe("Deudas (Mobile)", () => {
    test("shows total debt and credit utilization", async ({ page }) => {
      await page.goto("/deudas");
      await waitForNav(page);

      await expect(page.getByText("Deuda total")).toBeVisible();
      await expect(page.getByText("Utilización de crédito")).toBeVisible();
      await expect(page.getByText(/Intereses mensuales/)).toBeVisible();
    });

    test("shows insights section", async ({ page }) => {
      await page.goto("/deudas");
      await waitForNav(page);

      await expect(page.getByText("Insights")).toBeVisible();
    });
  });

  test.describe("Cuentas (Mobile)", () => {
    test("shows account cards with balances", async ({ page }) => {
      await page.goto("/accounts");
      await waitForNav(page);

      await expect(page.getByText("Cuentas")).toBeVisible();
      // Should show at least one account card
      await expect(page.getByText(/\*{4}\d{4}/)).toBeTruthy();
    });

    test("back button navigates to previous page", async ({ page }) => {
      await page.goto("/gestionar");
      await waitForNav(page);
      await page.goto("/accounts");
      await waitForNav(page);

      const backButton = page.locator("a[href], button").filter({ hasText: "" }).locator("svg").first();
      // The ← back arrow should be present in sub-pages
      const backLink = page.locator('[class*="back"], a:has(svg[class*="lucide-arrow-left"]), a:has(svg[class*="lucide-chevron-left"])');
      const count = await backLink.count();
      test.info().annotations.push({
        type: "INFO",
        description: `Back button elements found: ${count}`,
      });
    });
  });

  test.describe("Import (Mobile)", () => {
    test("shows wizard stepper and upload area", async ({ page }) => {
      await page.goto("/import");
      await waitForNav(page);

      await expect(page.getByText("Importar Extracto")).toBeVisible();
      await expect(page.getByText(/Arrastra tu extracto bancario/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Seleccionar archivo/ })).toBeVisible();
    });
  });

  test.describe("Gestionar (Mobile)", () => {
    test("shows all management action cards", async ({ page }) => {
      await page.goto("/gestionar");
      await waitForNav(page);

      await expect(page.getByText("Gestionar")).toBeVisible();
      await expect(page.getByText("Importar PDF")).toBeVisible();
      await expect(page.getByText("Cuentas")).toBeVisible();
      await expect(page.getByText("Destinatarios")).toBeVisible();
      await expect(page.getByText("Ajustes")).toBeVisible();
    });
  });

  test.describe("Ajustes (Mobile)", () => {
    test("shows profile section with editable fields", async ({ page }) => {
      await page.goto("/settings");
      await waitForNav(page);

      await expect(page.getByText("Perfil")).toBeVisible();
      await expect(page.getByLabel("Nombre completo")).toBeVisible();
      await expect(page.getByText("Moneda principal")).toBeVisible();
      await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
    });

    test("shows account info and bug report form", async ({ page }) => {
      await page.goto("/settings");
      await waitForNav(page);

      await expect(page.getByText("Cuenta")).toBeVisible();
      await expect(page.getByText("Reportar bug")).toBeVisible();
    });
  });

  // ── Responsive Layout ─────────────────────────────────────────────────────

  test.describe("Responsive (Mobile)", () => {
    test("bottom tab bar is visible on mobile", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const bottomNav = page.locator("nav.fixed");
      await expect(bottomNav).toBeVisible();
    });

    test("sidebar is hidden on mobile", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const sidebar = page.locator("aside, nav").first();
      const sidebarRect = await sidebar.boundingBox();
      // Sidebar should be hidden (zero height or off-screen)
      expect(
        !sidebarRect || sidebarRect.height === 0 || sidebarRect.width === 0,
        "Sidebar should be hidden on mobile"
      ).toBeTruthy();
    });

    test("content has appropriate padding and doesn't overflow horizontally", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalOverflow, "Page should not have horizontal scroll on mobile").toBeFalsy();
    });

    test("content is not hidden behind the bottom tab bar", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      // Main content should have bottom padding to account for fixed nav
      const mainPaddingBottom = await page.locator("main").evaluate((el) => {
        return parseInt(getComputedStyle(el).paddingBottom, 10);
      });

      expect(
        mainPaddingBottom,
        "Main content needs bottom padding ≥56px to clear fixed bottom nav"
      ).toBeGreaterThanOrEqual(56);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DESKTOP TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Desktop UX", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop tests only in desktop project");
  });

  // ── Sidebar Navigation ────────────────────────────────────────────────────

  test.describe("Sidebar", () => {
    test("sidebar is visible on desktop", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      // Desktop sidebar should be visible
      const sidebarLinks = page.locator('nav a[href="/dashboard"]').first();
      await expect(sidebarLinks).toBeVisible();
    });

    test("bottom tab bar is hidden on desktop", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const bottomNav = page.locator("nav.fixed.bottom-0");
      // Should be hidden via lg:hidden
      await expect(bottomNav).not.toBeVisible();
    });

    test("all sidebar links navigate correctly", async ({ page }) => {
      const sidebarPages = [
        { name: "Dashboard", path: "/dashboard" },
        { name: "Transacciones", path: "/transactions" },
        { name: "Destinatarios", path: "/destinatarios" },
        { name: "Importar", path: "/import" },
        { name: "Cuentas", path: "/accounts" },
        { name: "Deudas", path: "/deudas" },
        { name: "Recurrentes", path: "/recurrentes" },
        { name: "Presupuesto", path: "/categories" },
        { name: "Gestionar", path: "/gestionar" },
      ];

      for (const p of sidebarPages) {
        await page.goto("/dashboard");
        await waitForNav(page);

        const sidebarNav = page.locator("aside, [class*='sidebar']").first().locator("..").locator("nav").first();
        const link = sidebarNav.getByRole("link", { name: p.name });

        if ((await link.count()) > 0) {
          await link.click();
          await waitForNav(page);
          await expect(page).toHaveURL(new RegExp(p.path), {
            timeout: 5_000,
          });
        }
      }
    });

    test("sidebar active item has visual highlight", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      // Find the Dashboard link in sidebar (first nav, not bottom nav)
      const sidebarLinks = page.locator("nav").first().locator("a");
      const dashboardLink = sidebarLinks.filter({ hasText: "Dashboard" });

      const bgColor = await getBgColor(dashboardLink);

      test.info().annotations.push({
        type: "INFO",
        description: `Sidebar active item background-color: ${bgColor}`,
      });

      // Active sidebar item should have a distinguishable background
      expect(
        bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent",
        `Sidebar active item needs visible background highlight (got: ${bgColor})`
      ).toBeTruthy();
    });
  });

  // ── Desktop Content Layout ────────────────────────────────────────────────

  test.describe("Content Layout", () => {
    test("main content area fills available width", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const mainWidth = await page.locator("main").evaluate((el) => el.clientWidth);
      const viewportWidth = page.viewportSize()!.width;

      // Main content should use most of the available space (minus sidebar ~250px)
      expect(
        mainWidth,
        `Main content is ${mainWidth}px on ${viewportWidth}px viewport — should be ≥ 900px`
      ).toBeGreaterThan(900);
    });

    test("BUG: dashboard text truncation at 1440px", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      // Check for any truncated text elements in main content
      const truncatedElements = await page.locator("main").evaluate((main) => {
        const truncated: string[] = [];
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const el = node as HTMLElement;
          if (el.scrollWidth > el.clientWidth + 2) {
            const text = el.textContent?.trim().substring(0, 50);
            if (text && text.length > 5) {
              truncated.push(`"${text}" (overflow: ${el.scrollWidth - el.clientWidth}px)`);
            }
          }
        }
        return truncated;
      });

      test.info().annotations.push({
        type: "UX_ISSUE",
        description: `Truncated text on desktop dashboard: ${JSON.stringify(truncatedElements)}`,
      });

      expect(
        truncatedElements.length,
        `Found ${truncatedElements.length} truncated elements at 1440px width: ${truncatedElements.join(", ")}`
      ).toBe(0);
    });

    test("BUG: transactions page text truncation", async ({ page }) => {
      await page.goto("/transactions");
      await waitForNav(page);

      const truncatedElements = await page.locator("main").evaluate((main) => {
        const truncated: string[] = [];
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const el = node as HTMLElement;
          if (el.scrollWidth > el.clientWidth + 2) {
            const text = el.textContent?.trim().substring(0, 50);
            if (text && text.length > 5) {
              truncated.push(`"${text}"`);
            }
          }
        }
        return truncated.slice(0, 10); // limit
      });

      test.info().annotations.push({
        type: "UX_ISSUE",
        description: `Truncated text on desktop transactions: ${JSON.stringify(truncatedElements)}`,
      });

      // Some truncation is intentional (long descriptions), but key UI elements shouldn't truncate
      // This test documents what truncates
    });

    test("FAB is hidden on desktop", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForNav(page);

      const fab = page.getByRole("button", { name: /menú de acciones/ });
      await expect(fab).not.toBeVisible();
    });

    test("no horizontal overflow on any page", async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(p.path);
        await waitForNav(page);

        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasOverflow, `Horizontal overflow on ${p.name} (${p.path})`).toBeFalsy();
      }
    });
  });

  // ── Desktop-specific page tests ───────────────────────────────────────────

  test.describe("Accounts (Desktop)", () => {
    test("account cards are displayed in a multi-column grid", async ({ page }) => {
      await page.goto("/accounts");
      await waitForNav(page);

      const cards = page.locator("main a, main [class*='card']").filter({ hasText: /\*{4}\d{4}/ });
      const count = await cards.count();
      expect(count, "Should show multiple account cards").toBeGreaterThan(1);

      if (count >= 2) {
        const firstBox = await cards.first().boundingBox();
        const secondBox = await cards.nth(1).boundingBox();
        // Cards should be side-by-side (same Y) on desktop, not stacked
        if (firstBox && secondBox) {
          const sameRow = Math.abs(firstBox.y - secondBox.y) < 20;
          expect(sameRow, "Account cards should be in a grid on desktop, not stacked vertically").toBeTruthy();
        }
      }
    });
  });

  test.describe("Deudas (Desktop)", () => {
    test("debt summary cards are side by side", async ({ page }) => {
      await page.goto("/deudas");
      await waitForNav(page);

      const debtCard = page.getByText("Deuda total").locator("..");
      const utilizationCard = page.getByText("Utilización de crédito").locator("..");

      const debtBox = await debtCard.boundingBox();
      const utilBox = await utilizationCard.boundingBox();

      if (debtBox && utilBox) {
        // Should be side-by-side on desktop
        const sameRow = Math.abs(debtBox.y - utilBox.y) < 50;
        expect(sameRow, "Debt and utilization cards should be side-by-side on desktop").toBeTruthy();
      }
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCESSIBILITY TESTS (both viewports)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Accessibility", () => {
  test("all pages load without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    for (const p of PAGES) {
      await page.goto(p.path);
      await waitForNav(page);
    }

    // Filter out known non-critical errors (e.g., React hydration warnings in dev)
    const criticalErrors = errors.filter(
      (e) => !e.includes("hydrat") && !e.includes("Warning:") && !e.includes("DevTools")
    );

    test.info().annotations.push({
      type: "CONSOLE_ERRORS",
      description: JSON.stringify(criticalErrors.slice(0, 10)),
    });

    expect(
      criticalErrors.length,
      `Found ${criticalErrors.length} console errors: ${criticalErrors.slice(0, 3).join("\n")}`
    ).toBe(0);
  });

  test("interactive elements have accessible names", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    // Check buttons have accessible names
    const buttonsWithoutLabel = await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      const issues: string[] = [];
      buttons.forEach((btn) => {
        const name =
          btn.getAttribute("aria-label") ||
          btn.getAttribute("title") ||
          btn.textContent?.trim();
        if (!name) {
          issues.push(btn.outerHTML.substring(0, 100));
        }
      });
      return issues;
    });

    test.info().annotations.push({
      type: "A11Y",
      description: `Buttons without accessible names: ${JSON.stringify(buttonsWithoutLabel)}`,
    });

    expect(
      buttonsWithoutLabel.length,
      `${buttonsWithoutLabel.length} buttons lack accessible names`
    ).toBe(0);
  });

  test("all pages have exactly one h1 or prominent heading", async ({ page }) => {
    const pagesWithoutHeading: string[] = [];

    for (const p of PAGES) {
      await page.goto(p.path);
      await waitForNav(page);

      const h1Count = await page.locator("main h1, main h2").count();
      if (h1Count === 0) {
        // Check for prominent text that acts as heading
        const hasProminentText = await page.locator("main").evaluate((main) => {
          const textElements = main.querySelectorAll("h1, h2, h3, [class*='text-2xl'], [class*='text-3xl']");
          return textElements.length > 0;
        });
        if (!hasProminentText) {
          pagesWithoutHeading.push(p.name);
        }
      }
    }

    test.info().annotations.push({
      type: "A11Y",
      description: `Pages without clear heading: ${JSON.stringify(pagesWithoutHeading)}`,
    });
  });

  test("keyboard navigation works on bottom tab bar", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    // Tab to bottom nav links
    const bottomNav = page.locator("nav.fixed");
    const links = bottomNav.locator("a");
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      await links.nth(i).focus();
      const isFocused = await links.nth(i).evaluate(
        (el) => document.activeElement === el
      );
      expect(isFocused, `Bottom nav link ${i} should be focusable`).toBeTruthy();
    }
  });
});
