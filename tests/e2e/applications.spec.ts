import { expect, test, type Page } from "@playwright/test";

const password = "long-enough-1";
const stages = [
  "Offer",
  "Interview not done",
  "OA not done",
  "In progress",
  "Applied",
  "Rejected",
];

async function signIn(page: Page) {
  const email = `applications.${Date.now()}@example.com`;
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

test("home lists the six fixture stages and opens the source", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/applications");

  await expect(
    page.getByRole("heading", { name: "Your applications" }),
  ).toBeVisible();
  await expect(page.getByText("Synced today, 9:45 AM")).toBeVisible();
  await expect(page.locator("main button")).toHaveCount(0);

  await expect(page.locator(".stage-word")).toHaveText(stages);
  await expect(page.getByText("Stage unchanged")).toBeVisible();
  await expect(
    page.getByText(
      "The Browser Company · Application received · Outlook school",
    ),
  ).toBeVisible();

  const desk = page.locator("main.desk");
  const row = page.locator(".row").first();
  const [deskBackground, rowBackground] = await Promise.all([
    desk.evaluate((element) => getComputedStyle(element).backgroundColor),
    row.evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(rowBackground).not.toBe(deskBackground);

  const source = page.getByRole("link", { name: "Source for Fable" });
  const meta = page.locator(".meta").first();
  const [sourceColor, metaColor] = await Promise.all([
    source.evaluate((element) => getComputedStyle(element).color),
    meta.evaluate((element) => getComputedStyle(element).color),
  ]);
  expect(sourceColor).not.toBe(metaColor);
  const sources = page.getByRole("link", { name: /^Source for / });
  const [firstBox, secondBox] = await Promise.all([
    sources.nth(0).boundingBox(),
    sources.nth(1).boundingBox(),
  ]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(Math.min(firstBox!.width, firstBox!.height)).toBeGreaterThanOrEqual(
    24,
  );
  expect(secondBox!.y).toBeGreaterThanOrEqual(
    firstBox!.y + firstBox!.height + 8,
  );

  await page.setViewportSize({ width: 375, height: 800 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(false);

  await expect(source).toHaveAttribute(
    "href",
    "https://example.com/mail/fable",
  );
  await page.route("https://example.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<p>Fixture message</p>",
    }),
  );
  await source.click();
  await expect(page).toHaveURL("https://example.com/mail/fable");
  await expect(page.getByText("Fixture message")).toBeVisible();
});

test("the applied row is still there after leaving the desk", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/applications");
  await expect(page.getByText("Stage unchanged")).toBeVisible();
  await page.goto("/mailboxes");
  await page.goto("/applications");
  await expect(page.getByText("Applied", { exact: true })).toBeVisible();
  await expect(page.getByText("Stage unchanged")).toBeVisible();
});
