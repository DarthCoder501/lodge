import { expect, test, type Page } from "@playwright/test";

const password = "long-enough-1";

async function signIn(page: Page) {
  const email = `sync.${Date.now()}@example.com`;
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

test("fixture statuses match the empty, loading, and sync frames", async ({
  page,
}) => {
  const providers: string[] = [];
  page.on("request", (request) => {
    if (
      /accounts\.google|gmail\.|login\.microsoft|graph\.microsoft|outlook\.office/i.test(
        request.url(),
      )
    ) {
      providers.push(request.url());
    }
  });

  await signIn(page);

  await page.goto("/applications?status=empty");
  await expect(
    page.getByRole("heading", { name: "Your applications" }),
  ).toBeVisible();
  await expect(page.getByText("No mailbox connected")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A quiet start" }),
  ).toBeVisible();
  await expect(
    page.getByText("Connect Gmail or Outlook to find applications."),
  ).toBeVisible();
  await expect(page.locator(".stage-word")).toHaveCount(0);
  await expect(page.locator("main .primary")).toHaveCount(1);
  const go = page.getByRole("link", { name: "Go to mailboxes" });
  const goBox = await go.boundingBox();
  expect(goBox).not.toBeNull();
  expect(Math.min(goBox!.width, goBox!.height)).toBeGreaterThanOrEqual(44);
  const [deskBackground, emptyBackground] = await Promise.all([
    page
      .locator("main.desk")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    page
      .locator(".empty")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(emptyBackground).not.toBe(deskBackground);
  await page.setViewportSize({ width: 375, height: 800 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(false);

  await page.goto("/applications?status=recognized");
  await expect(
    page.getByRole("heading", { name: "Nothing recognized yet" }),
  ).toBeVisible();
  await expect(
    page.getByText("This mailbox is connected. No applications yet."),
  ).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(1);
  const view = page.getByRole("link", { name: "View connected mailbox" });
  await view.click();
  await expect(page).toHaveURL(/\/mailboxes$/);
  await page.goBack();

  await page.goto("/applications?status=loading");
  await expect(page.getByText("Loading your applications")).toBeVisible();
  await expect(page.locator(".ticks span")).toHaveCount(3);
  await expect(page.locator("main .primary")).toHaveCount(0);
  await expect(page.locator(".stage-word")).toHaveCount(0);

  await page.goto("/applications?status=running");
  await expect(page.getByText("Syncing", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Syncing mailboxes. You can keep working."),
  ).toBeVisible();
  await expect(page.locator(".stage-word")).toHaveCount(6);
  await expect(page.locator("main .primary")).toHaveCount(0);
  const source = page.getByRole("link", { name: "Source for Fable" });
  const [sourceColor, metaColor] = await Promise.all([
    source.evaluate((element) => getComputedStyle(element).color),
    page
      .locator(".meta")
      .first()
      .evaluate((element) => getComputedStyle(element).color),
  ]);
  expect(sourceColor).not.toBe(metaColor);

  await page.goto("/applications?status=finished");
  await expect(page.getByText("Synced just now")).toBeVisible();
  await expect(page.getByText("Your list is up to date.")).toBeVisible();
  await expect(page.getByText("Offer", { exact: true })).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(0);

  await page.goto("/applications?status=return");
  await expect(page.getByText("Synced today, 9:45 AM")).toBeVisible();
  await expect(page.getByText("Your list is up to date.")).toHaveCount(0);
  await expect(page.locator(".stage-word")).toHaveCount(6);
  await expect(page.locator("main .primary")).toHaveCount(0);

  await page.goto("/applications?status=failed");
  const failed = page.locator("main").getByRole("alert");
  await expect(failed).toHaveText(
    "Sync couldn’t finish. Saved applications are unchanged.",
  );
  await expect(page.getByText("Synced today, 9:45 AM")).toBeVisible();
  await expect(page.getByText("Offer", { exact: true })).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(1);
  const retry = page.getByRole("button", { name: "Retry sync" });
  const retryBox = await retry.boundingBox();
  expect(retryBox).not.toBeNull();
  expect(Math.min(retryBox!.width, retryBox!.height)).toBeGreaterThanOrEqual(
    44,
  );
  const filters = page
    .getByRole("navigation", { name: "Filters" })
    .getByRole("button");
  const [allBox, sinceBox] = await Promise.all([
    filters.nth(0).boundingBox(),
    filters.nth(1).boundingBox(),
  ]);
  expect(sinceBox!.x).toBeGreaterThanOrEqual(allBox!.x + allBox!.width + 8);
  await retry.click();
  await expect(failed).toBeVisible();
  await expect(page).toHaveURL(/status=failed/);
  await expect(page.locator(".stage-word")).toHaveCount(6);

  await page.goto("/mailboxes");
  await page.goto("/applications?status=failed");
  await expect(failed).toBeVisible();
  expect(providers).toEqual([]);
});
