import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for Next.js hydration to settle */
async function waitForNav(page: Page) {
  await page
    .waitForLoadState("networkidle", { timeout: 10_000 })
    .catch(() => {});
}

/**
 * Simulate a mobile virtual keyboard by overriding `visualViewport.height`.
 *
 * On real devices the keyboard shrinks `visualViewport.height` while
 * `window.innerHeight` stays constant. We replicate that by patching the
 * getter and dispatching a resize event so that `useKeyboardInset` reacts.
 */
async function simulateKeyboardOpen(page: Page, keyboardHeight = 300) {
  await page.evaluate((kbHeight) => {
    const vv = window.visualViewport;
    if (!vv) return;

    const realHeight = window.innerHeight - kbHeight;

    Object.defineProperty(vv, "height", {
      get: () => realHeight,
      configurable: true,
    });
    Object.defineProperty(vv, "offsetTop", {
      get: () => 0,
      configurable: true,
    });

    vv.dispatchEvent(new Event("resize"));
  }, keyboardHeight);

  // Give RAF-based hook time to update
  await page.waitForTimeout(100);
}

/** Restore the original visualViewport height (keyboard dismiss) */
async function simulateKeyboardClose(page: Page) {
  await page.evaluate(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    Object.defineProperty(vv, "height", {
      get: () => window.innerHeight,
      configurable: true,
    });
    Object.defineProperty(vv, "offsetTop", {
      get: () => 0,
      configurable: true,
    });

    vv.dispatchEvent(new Event("resize"));
  });

  await page.waitForTimeout(100);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Mobile keyboard UX", () => {
  test.use({
    // Ensure we only run in the mobile project
    viewport: { width: 412, height: 915 },
    isMobile: true,
  });

  test("FAB hides when keyboard opens and reappears when it closes", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const fab = page.getByTestId("fab-button");

    // FAB should be visible initially
    await expect(fab).toBeVisible();

    // Simulate keyboard
    await simulateKeyboardOpen(page);
    await expect(fab).toBeHidden();

    // Dismiss keyboard
    await simulateKeyboardClose(page);
    await expect(fab).toBeVisible();
  });

  test("bottom tab bar hides when keyboard opens", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    const tabBar = page.getByTestId("bottom-tab-bar");

    // Tab bar visible by default
    await expect(tabBar).toBeVisible();

    // Simulate keyboard
    await simulateKeyboardOpen(page);
    await expect(tabBar).toBeHidden();

    // Dismiss keyboard
    await simulateKeyboardClose(page);
    await expect(tabBar).toBeVisible();
  });

  test("form gets extra padding when keyboard is open", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForNav(page);

    // Open the FAB to get the transaction form sheet
    const fab = page.getByTestId("fab-button");
    await fab.click();

    // Wait for the drawer to open — find the form inside
    const form = page.locator("form.space-y-4");
    await expect(form).toBeVisible({ timeout: 5_000 });

    // Before keyboard: no inline paddingBottom (or the default CSS value)
    const paddingBefore = await form.evaluate(
      (el) => el.style.paddingBottom,
    );

    // Open keyboard
    await simulateKeyboardOpen(page, 280);

    const paddingAfter = await form.evaluate(
      (el) => el.style.paddingBottom,
    );

    // The keyboard-aware form should now have inline padding > 0
    expect(paddingAfter).toMatch(/\d+px/);
    expect(parseInt(paddingAfter)).toBeGreaterThan(0);

    // The padding should be larger than before (or was empty)
    if (paddingBefore && paddingBefore !== "") {
      expect(parseInt(paddingAfter)).toBeGreaterThan(
        parseInt(paddingBefore) || 0,
      );
    }
  });

  test("fixed elements do not overlap input when keyboard is open", async ({
    page,
  }) => {
    await page.goto("/transactions");
    await waitForNav(page);

    // Simulate keyboard open
    await simulateKeyboardOpen(page);

    // FAB and tab bar should be gone
    const fab = page.getByTestId("fab-button");
    const tabBar = page.getByTestId("bottom-tab-bar");

    await expect(fab).toBeHidden();
    await expect(tabBar).toBeHidden();
  });
});
