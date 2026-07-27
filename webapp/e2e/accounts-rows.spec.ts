import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

/** Presupuesto de altura de una fila colapsada. Es el criterio que hace que
 *  la lista quepa: con tarjetas se veían 1,5 cuentas por pantalla. */
const MAX_ROW_HEIGHT = 88;

/** Localiza solo las filas de cuenta, no cualquier botón expandible.
 *  El overlay de Next.js Dev Tools también expone aria-expanded, y sin este
 *  filtro los tests pasaban contra la pantalla de login sin tocar una fila. */
const ACCOUNT_ROW = 'div:has(> button[aria-expanded]) > button[aria-expanded]';

/**
 * Sin sesión válida, /accounts redirige a /login y TODA aserción sobre
 * ausencia de cosas pasa trivialmente. Esta guarda convierte ese caso en un
 * fallo ruidoso en vez de un falso verde.
 *
 * Si falla: el storageState de e2e/.auth/user.json caducó. Renuévalo con
 *   TEST_PASSWORD=xxx pnpm --dir webapp exec playwright test --project=setup
 */
async function gotoAccounts(page: import("@playwright/test").Page) {
  await page.goto("/accounts");
  await expect(
    page.getByRole("heading", { name: /^Cuentas$/ }).first(),
    "sesión no autenticada — renueva e2e/.auth/user.json",
  ).toBeVisible();
}

test.describe("/accounts en filas", () => {
  test("las filas colapsadas no pasan del presupuesto de altura", async ({ page }) => {
    await gotoAccounts(page);
    const rows = page.locator(ACCOUNT_ROW);
    await expect(rows.first()).toBeVisible();

    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await rows.nth(i).boundingBox();
      expect(box, `fila ${i} sin caja`).not.toBeNull();
      expect(box!.height, `fila ${i}`).toBeLessThanOrEqual(MAX_ROW_HEIGHT);
    }
  });

  test("no hay scroll horizontal a 375px", async ({ page }) => {
    await gotoAccounts(page);
    await expect(page.locator(ACCOUNT_ROW).first()).toBeVisible();
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("tocar la fila la expande y ofrece navegar al detalle", async ({ page }) => {
    await gotoAccounts(page);
    // Sin filtrar por valor: `[aria-expanded="false"]` deja de coincidir en
    // cuanto la fila abre, y Playwright re-resuelve el localizador en cada
    // aserción — la comprobación fallaría por no encontrar el elemento.
    const first = page.locator(ACCOUNT_ROW).first();
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");

    // Se afirma el destino, no se navega: seguir el enlace exige un refresco
    // de sesión que el storageState guardado no siempre aguanta, y el fallo
    // sería del fixture, no de la fila. Lo que esta prueba defiende es que la
    // expansión ofrezca una salida explícita al detalle.
    const verDetalle = page
      .locator('a[href^="/accounts/"]')
      .filter({ hasText: /ver detalle/i })
      .first();
    await expect(verDetalle).toBeVisible();
    await expect(verDetalle).toHaveAttribute(
      "href",
      /^\/accounts\/[0-9a-f-]{36}$/,
    );
  });

  test("todo elemento interactivo tiene nombre accesible", async ({ page }) => {
    await gotoAccounts(page);
    await expect(page.locator(ACCOUNT_ROW).first()).toBeVisible();
    const unnamed = await page.evaluate(() => {
      const els = [...document.querySelectorAll("button,a,[role=button]")];
      return els
        .filter(
          (e) =>
            !(
              e.getAttribute("aria-label") ||
              e.getAttribute("title") ||
              e.textContent ||
              ""
            ).trim(),
        )
        .length;
    });
    expect(unnamed).toBe(0);
  });

  test("sin ?saldadas=1 todas las filas nacen colapsadas", async ({ page }) => {
    await gotoAccounts(page);
    await expect(page.locator(ACCOUNT_ROW).first()).toBeVisible();
    expect(await page.locator(ACCOUNT_ROW + '[aria-expanded="true"]').count()).toBe(0);
  });
});
