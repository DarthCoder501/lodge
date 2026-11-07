import { expect, test, type Page } from "@playwright/test";

const password = "long-enough-1";

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
  await expect(page.getByRole("status")).toBeVisible();
}

test("a signed-out request for a lodge route goes to sign in", async ({
  page,
}) => {
  for (const path of ["/applications", "/mailboxes", "/account"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  }
});

test("the timber wall stays across the desk and sign out leaves", async ({
  page,
}) => {
  const email = `shell.${Date.now()}@example.com`;
  await createAndSignIn(page, email);
  await page.goto("/applications");

  const wall = page.locator(".wall");
  const desk = page.locator("main.desk");
  await expect(wall).toBeVisible();
  await expect(desk).toBeVisible();
  await expect(wall).toContainText("Lodge");
  await expect(wall).toContainText(email);

  const routes = [
    ["/applications", "Applications"],
    ["/mailboxes", "Mailboxes"],
    ["/account", "Account"],
  ] as const;

  for (const [path, name] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(wall).toBeVisible();
    const current = page.getByRole("link", { name });
    await expect(current).toHaveAttribute("aria-current", "page");
    const [
      linkBackground,
      wallBackground,
      deskBackground,
      deskColor,
      linkColor,
    ] = await Promise.all([
      current.evaluate((element) => getComputedStyle(element).backgroundColor),
      wall.evaluate((element) => getComputedStyle(element).backgroundColor),
      desk.evaluate((element) => getComputedStyle(element).backgroundColor),
      desk.evaluate((element) => getComputedStyle(element).color),
      page
        .getByRole("link", { name: "Applications" })
        .evaluate((element) => getComputedStyle(element).color),
    ]);
    expect(linkBackground).toBe("rgb(122, 56, 34)");
    expect(wallBackground).toBe("rgb(44, 36, 28)");
    expect(deskBackground).toBe("rgb(244, 239, 230)");
    expect(deskBackground).not.toBe(wallBackground);
    expect(linkColor).not.toBe(deskColor);

    const box = await current.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
  }

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/account");
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
  await expect(wall).toBeVisible();

  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(1);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in\?out=1$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("You’re signed out.");
});
