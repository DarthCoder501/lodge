import { expect, test, type Locator, type Page } from "@playwright/test";

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

async function createAccount(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("long-enough-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
}

async function verification(page: Page, email: string) {
  const response = await page.request.get(
    `/verify/outbox?email=${encodeURIComponent(email)}`,
  );
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    link: string;
    verified: boolean | null;
  };
  expect(body.link.startsWith("/verify?token=")).toBe(true);
  return body;
}

test.describe("verification", () => {
  test("check your email can send another link", async ({ page }) => {
    const email = `check.${Date.now()}@example.com`;
    await createAccount(page, email);
    await expect(page.getByRole("status")).toContainText(email);
    await expect(
      page.getByRole("link", { name: "Keep using Lodge" }),
    ).toHaveAttribute("href", "/sign-in");
    const primary = page.locator(".primary");
    await expect(primary).toHaveCount(1);
    const button = await box(primary);
    const quiet = await box(
      page.getByRole("button", { name: "Send a new link" }),
    );
    expect(Math.min(button.width, button.height)).toBeGreaterThanOrEqual(44);
    expect(Math.min(quiet.width, quiet.height)).toBeGreaterThanOrEqual(24);
    expect(quiet.y - (button.y + button.height)).toBeGreaterThanOrEqual(8);

    await page.evaluate(() => {
      sessionStorage.removeItem("sawSending");
      new MutationObserver(() => {
        if (document.body.textContent?.includes("Sending a new link")) {
          sessionStorage.setItem("sawSending", "yes");
        }
      }).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
    await page.getByRole("button", { name: "Send a new link" }).click();
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("sawSending")))
      .toBe("yes");
    await expect(
      page.getByRole("heading", { name: "A new link is on its way" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "the previous link no longer works",
    );
    await expect(page.locator(".primary")).toHaveCount(1);
  });

  test("a valid link verifies and a second open is already used", async ({
    page,
  }) => {
    const email = `valid.${Date.now()}@example.com`;
    await createAccount(page, email);
    const { link } = await verification(page, email);
    const token = new URL(link, "http://127.0.0.1:3000").searchParams.get(
      "token",
    );
    expect(token).toBeTruthy();
    await page.goto(link);
    await expect(
      page.getByRole("heading", { name: "Your email is verified" }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.locator("main")).not.toContainText(token ?? "");
    await expect(page.locator(".primary")).toHaveCount(1);

    const well = page.locator(".well");
    const label = await box(page.locator(".label"));
    const value = await box(well);
    const labelGap = value.y - (label.y + label.height);
    expect(labelGap).toBeGreaterThanOrEqual(0);
    expect(labelGap).toBeLessThan(18);
    const [wellBackground, deskBackground, linkColor, noteColor] =
      await Promise.all([
        well.evaluate((element) => getComputedStyle(element).backgroundColor),
        page
          .locator("main")
          .evaluate((element) => getComputedStyle(element).backgroundColor),
        page
          .locator(".quiet")
          .evaluate((element) => getComputedStyle(element).color),
        page
          .locator(".note")
          .evaluate((element) => getComputedStyle(element).color),
      ]);
    expect(wellBackground).not.toBe(deskBackground);
    expect(linkColor).not.toBe(noteColor);
    await expect(
      page.getByRole("link", { name: "Go to mailboxes" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to applications" }),
    ).toBeVisible();

    expect((await verification(page, email)).verified).toBe(true);

    await page.goto(link);
    await expect(
      page.getByRole("heading", { name: "This link was already used" }),
    ).toBeVisible();
    await expect(page.locator(".note")).toContainText("Sign in");
    await expect(page.locator(".primary")).toHaveCount(1);
  });

  test("an expired link does not verify and can send a new one", async ({
    page,
  }) => {
    const email = `expired.${Date.now()}@example.com`;
    await createAccount(page, email);
    const { link } = await verification(page, email);
    const aged = await page.request.post(
      `/verify/outbox?email=${encodeURIComponent(email)}`,
    );
    expect(aged.status()).toBe(204);
    await page.goto(link);
    await expect(
      page.getByRole("heading", { name: "This link has expired" }),
    ).toBeVisible();
    await expect(page.locator(".note")).toContainText(email);
    expect((await verification(page, email)).verified).toBe(false);

    await page.getByRole("button", { name: "Send a new link" }).click();
    await expect(
      page.getByRole("heading", { name: "A new link is on its way" }),
    ).toBeVisible();
    expect((await verification(page, email)).verified).toBe(false);
  });

  test("an invalid link shows its frame", async ({ page }) => {
    const email = `invalid.${Date.now()}@example.com`;
    await createAccount(page, email);
    await page.goto("/verify?token=not-a-real-token");
    await expect(
      page.getByRole("heading", { name: /This link doesn.t look right/ }),
    ).toBeVisible();
    await expect(page.locator(".note")).toContainText(
      "sign in and send a new one",
    );
    await expect(
      page.getByRole("link", { name: "Go to sign in" }),
    ).toHaveAttribute("href", "/sign-in");
    await expect(
      page.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/sign-in");
    await expect(page.locator(".primary")).toHaveCount(1);
    const primary = await box(page.locator(".primary"));
    const quiet = await box(
      page.getByRole("link", { name: "Request a new link" }),
    );
    expect(Math.min(primary.width, primary.height)).toBeGreaterThanOrEqual(44);
    expect(Math.min(quiet.width, quiet.height)).toBeGreaterThanOrEqual(24);
    expect(quiet.y - (primary.y + primary.height)).toBeGreaterThanOrEqual(8);

    expect((await verification(page, email)).verified).toBe(false);

    await page.goto("/verify");
    await expect(
      page.getByRole("heading", { name: /This link doesn.t look right/ }),
    ).toBeVisible();
  });

  test("fits a phone width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/verify?token=not-a-real-token");
    await expect(
      page.getByRole("heading", { name: /This link doesn.t look right/ }),
    ).toBeVisible();
    const primary = await box(page.locator(".primary"));
    expect(Math.min(primary.width, primary.height)).toBeGreaterThanOrEqual(44);
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});
