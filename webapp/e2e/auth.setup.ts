import { test as setup, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "giraldo.0302@gmail.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

setup("authenticate", async ({ page }) => {
  if (!TEST_PASSWORD) {
    throw new Error(
      "Set TEST_PASSWORD env var to run E2E tests.\n" +
        "  TEST_PASSWORD=xxx npx playwright test"
    );
  }

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(TEST_EMAIL);
  await page.getByLabel("Contraseña").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Save auth cookies
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
