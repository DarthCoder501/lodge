import { expect, test, type Locator, type Page } from "@playwright/test";

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

async function noHorizontalScroll(page: Page) {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
}

test.describe("sign-up", () => {
  test("shows one primary action and keeps the fields together", async ({ page }) => {
    await page.goto("/sign-up");

    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toHaveCount(1);
    await expect(page.getByRole("textbox")).toHaveCount(2);
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
    await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "new-password");

    const submit = await box(page.getByRole("button", { name: "Create account" }));
    const show = await box(page.getByRole("button", { name: "Show password" }));
    const password = await box(page.getByLabel("Password"));
    expect(Math.min(submit.width, submit.height)).toBeGreaterThanOrEqual(44);
    expect(Math.min(show.width, show.height)).toBeGreaterThanOrEqual(24);
    const sideBySide = show.y < password.y + password.height;
    const gap = sideBySide
      ? show.x - (password.x + password.width)
      : show.y - (password.y + password.height);
    expect(gap).toBeGreaterThanOrEqual(8);

    const emailLabel = await box(page.locator("label[for='email']"));
    const email = await box(page.getByLabel("Email"));
    const passwordLabel = await box(page.locator("label[for='password']"));
    const labelGap = email.y - (emailLabel.y + emailLabel.height);
    const fieldGap = passwordLabel.y - (email.y + email.height);
    expect(labelGap).toBeGreaterThanOrEqual(0);
    expect(labelGap).toBeLessThan(fieldGap);

    const [formBackground, pageBackground, submitBackground, showBackground] = await Promise.all([
      page.locator("form").evaluate((element) => getComputedStyle(element).backgroundColor),
      page.locator("main").evaluate((element) => getComputedStyle(element).backgroundColor),
      page
        .getByRole("button", { name: "Create account" })
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      page
        .getByRole("button", { name: "Show password" })
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ]);
    expect(formBackground).not.toBe(pageBackground);
    expect(submitBackground).not.toBe(showBackground);
    await noHorizontalScroll(page);
  });

  test("shows a pending state while sign-up is still running", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill("pending@example.com");
    await page.getByLabel("Password").fill("long-enough-1");
    await page.evaluate(() => {
      sessionStorage.removeItem("sawPending");
      const button = document.querySelector("button[type='submit']");
      if (!button) return;
      new MutationObserver(() => {
        if (button.textContent?.includes("Creating account")) {
          sessionStorage.setItem("sawPending", "yes");
        }
      }).observe(button, { childList: true, characterData: true, subtree: true });
    });
    await page.getByRole("button", { name: "Create account" }).click();
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("sawPending")))
      .toBe("yes");
  });

  test("keeps typed values and names the outcome", async ({ page }) => {
    const email = `Person.${Date.now()}@Example.com`;
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short");
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#password-error")).toHaveText(
      "VALIDATION_ERROR. Password must be at least 10 characters",
    );
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Password")).toHaveValue("short");

    await page.getByLabel("Password").fill("long-enough-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("status")).toHaveText(
      `Account created for ${email.toLowerCase()}.`,
    );

    await page.getByLabel("Email").fill(email.toUpperCase());
    await page.getByLabel("Password").fill("another-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#email-error")).toHaveText(
      "EMAIL_TAKEN. An account with that email already exists",
    );
    await expect(page.getByLabel("Email")).toHaveValue(email.toUpperCase());
    await expect(page.getByLabel("Password")).toHaveValue("another-password");
  });

  test("fits a phone width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/sign-up");
    const submit = await box(page.getByRole("button", { name: "Create account" }));
    expect(Math.min(submit.width, submit.height)).toBeGreaterThanOrEqual(44);
    await noHorizontalScroll(page);
  });
});
