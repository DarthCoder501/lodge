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
  await expect(page.locator("main .primary")).toHaveCount(0);
  await expect(page.getByText("Nothing is pinned.")).toBeVisible();

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

test("filters, pins, and what’s new stay in this tab", async ({ page }) => {
  await signIn(page);
  await page.goto("/applications");
  await expect(page.getByText("Nothing is pinned.")).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(0);

  const filterButtons = page
    .getByRole("navigation", { name: "Filters" })
    .getByRole("button");
  const [allBox, sinceBox] = await Promise.all([
    filterButtons.nth(0).boundingBox(),
    filterButtons.nth(1).boundingBox(),
  ]);
  expect(allBox).not.toBeNull();
  expect(sinceBox).not.toBeNull();
  expect(Math.min(allBox!.width, allBox!.height)).toBeGreaterThanOrEqual(24);
  expect(sinceBox!.x).toBeGreaterThanOrEqual(allBox!.x + allBox!.width + 8);

  const sheetButton = page.getByRole("button", { name: "What’s new" });
  const sheetBox = await sheetButton.boundingBox();
  expect(sheetBox).not.toBeNull();
  expect(Math.min(sheetBox!.width, sheetBox!.height)).toBeGreaterThanOrEqual(
    24,
  );
  await sheetButton.click();
  const sheet = page.getByRole("complementary", { name: "What changed" });
  await expect(sheet.getByText("Since yesterday, 5:00 PM")).toBeVisible();
  await expect(sheet.getByText("Fable · Product Designer")).toBeVisible();
  await expect(sheet.getByText("Linear · Product Design Intern")).toBeVisible();
  await expect(sheet.getByText("Notion · Design Engineer")).toBeVisible();
  await expect(sheet.getByText("Offer", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Dropbox")).toHaveCount(0);
  await expect(sheet.getByText("Are.na")).toHaveCount(0);
  const close = sheet.getByRole("button", { name: "Close" });
  const closeBox = await close.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(Math.min(closeBox!.width, closeBox!.height)).toBeGreaterThanOrEqual(
    44,
  );
  await close.click();
  await expect(sheet).toHaveCount(0);

  const fable = page.locator(".row", {
    has: page.getByRole("link", { name: "Source for Fable" }),
  });
  const pin = fable.getByRole("button", { name: "Pin Fable" });
  const pinBox = await pin.boundingBox();
  expect(pinBox).not.toBeNull();
  expect(Math.min(pinBox!.width, pinBox!.height)).toBeGreaterThanOrEqual(24);
  await expect(fable).toHaveClass(/fresh/);
  await pin.click();
  await expect(fable).not.toHaveClass(/fresh/);
  await expect(
    fable.getByRole("button", { name: "Unpin Fable" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Nothing is pinned.")).toHaveCount(0);

  await page.getByRole("button", { name: "Since last visit" }).click();
  await expect(page.locator(".stage-word")).toHaveText([
    "Offer",
    "Interview not done",
    "OA not done",
  ]);
  await page.getByRole("button", { name: "Pinned", exact: true }).click();
  await expect(page.locator(".stage-word")).toHaveText(["Offer"]);
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.locator(".stage-word")).toHaveText(stages);

  await page.goto("/mailboxes");
  await page.goto("/applications");
  await expect(
    page.getByRole("button", { name: "Unpin Fable" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("an existing account arrival stays on the desk", async ({ page }) => {
  await signIn(page);
  await page.goto("/applications?entered=1");
  const email = (await page.locator(".session").textContent())?.trim();
  await expect(page.getByRole("status")).toHaveText(
    `Signed in as ${email}. Your applications are already here.`,
  );
  await expect(page.getByText("Nothing is pinned.")).toHaveCount(0);
  await expect(page.locator(".stage-word")).toHaveText(stages);
});
