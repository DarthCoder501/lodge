import { expect, test, type Page } from "@playwright/test";

const password = "long-enough-1";

async function noHorizontalScroll(page: Page) {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
}

async function createAndSignIn(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toHaveText(`Signed in as ${email.toLowerCase()}.`);
}

test("no session leaves the account page for sign-in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("two browsers each see only their own email", async ({ browser }) => {
  const stamp = Date.now();
  const emailA = `Isolation.A.${stamp}@Example.com`;
  const emailB = `Isolation.B.${stamp}@Example.com`;
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await createAndSignIn(pageA, emailA);
    await createAndSignIn(pageB, emailB);

    await pageA.goto(`/account?id=${encodeURIComponent(emailB)}`);
    await pageB.setViewportSize({ width: 375, height: 800 });
    await pageB.goto("/account");

    await expect(pageA.getByRole("heading", { name: "Account" })).toBeVisible();
    await expect(pageA.getByRole("status")).toHaveText(`Signed in as ${emailA.toLowerCase()}.`);
    await expect(pageA.getByText(emailB.toLowerCase())).toHaveCount(0);
    await expect(pageA.locator("main").getByRole("button")).toHaveCount(0);

    await expect(pageB.getByRole("status")).toHaveText(`Signed in as ${emailB.toLowerCase()}.`);
    await expect(pageB.getByText(emailA.toLowerCase())).toHaveCount(0);
    await noHorizontalScroll(pageA);
    await noHorizontalScroll(pageB);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
