import { expect, test, type Page } from "@playwright/test";

const password = "long-enough-1";
const wheel = [
  "Interview not done",
  "In progress",
  "Offer",
  "Rejected",
  "Applied",
  "OA not done",
];

async function signIn(page: Page) {
  const email = `review.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
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
  return email;
}

test("the wheel confirms a stage for this tab", async ({ page }) => {
  const email = await signIn(page);
  await page.goto("/applications");
  await expect(
    page.getByRole("button", { name: "Review The Browser Company" }),
  ).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(0);

  await page.goto("/mailboxes");
  await page.goto("/applications");
  await expect(page.getByText("Stage unchanged")).toBeVisible();

  await page
    .getByRole("button", { name: "Review The Browser Company" })
    .click();
  const sheet = page.getByRole("complementary", { name: "Move this stage?" });
  await expect(sheet.getByText("The Browser Company")).toBeVisible();
  await expect(
    sheet.getByText("We’d love a little time to hear about your process."),
  ).toBeVisible();
  const center = sheet.locator(".review-stop.center");
  await expect(center).toBeFocused();
  await expect(center).toHaveText("Interview not done");
  await expect(center.locator(".stop-label")).toHaveCSS(
    "font-variant-numeric",
    /tabular-nums/,
  );

  const seen: string[] = [];
  for (const label of wheel) {
    await expect(center).toHaveText(label);
    seen.push(label);
    await center.press("ArrowDown");
  }
  expect(new Set(seen).size).toBe(6);
  await expect(center).toHaveText("Interview not done");

  const [centerBox, notBox] = await Promise.all([
    center.boundingBox(),
    sheet.getByRole("button", { name: "Not a move" }).boundingBox(),
  ]);
  expect(centerBox).not.toBeNull();
  expect(notBox).not.toBeNull();
  expect(Math.min(centerBox!.width, centerBox!.height)).toBeGreaterThanOrEqual(
    44,
  );
  expect(Math.min(notBox!.width, notBox!.height)).toBeGreaterThanOrEqual(24);
  expect(notBox!.y).toBeGreaterThanOrEqual(
    centerBox!.y + centerBox!.height + 8,
  );

  const [
    deskBackground,
    sheetBackground,
    centerBackground,
    notColor,
    excerptColor,
  ] = await Promise.all([
    page
      .locator("main.desk")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    sheet.evaluate((element) => getComputedStyle(element).backgroundColor),
    center.evaluate((element) => getComputedStyle(element).backgroundColor),
    sheet
      .getByRole("button", { name: "Not a move" })
      .evaluate((element) => getComputedStyle(element).color),
    sheet
      .locator(".review-excerpt")
      .evaluate((element) => getComputedStyle(element).color),
  ]);
  expect(sheetBackground).not.toBe(deskBackground);
  expect(centerBackground).not.toBe(sheetBackground);
  expect(notColor).not.toBe(excerptColor);
  await expect(sheet.locator(".review-stop.center")).toHaveCount(1);

  await page.setViewportSize({ width: 375, height: 800 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(false);
  await page.setViewportSize({ width: 1280, height: 800 });

  await center.click();
  await expect(
    page.getByText(
      "The Browser Company · Stage confirmed by you · Outlook school",
    ),
  ).toBeVisible();
  await expect(page.locator(".stage-word").first()).toHaveText(
    "Interview not done",
  );
  await expect(page.getByText("Just now")).toBeVisible();
  await expect(page.getByText("Stage unchanged")).toHaveCount(0);
  await expect(sheet).toHaveCount(0);

  const stored = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    `lodge-application-reviews:${email}`,
  );
  expect(stored).toContain("interview-not-done");
  expect(stored).not.toContain("template");

  await page.goto("/mailboxes");
  await page.goto("/applications");
  await expect(page.locator(".stage-word").first()).toHaveText(
    "Interview not done",
  );
  await expect(page.getByText("Stage confirmed by you")).toBeVisible();
});

test("not a move keeps the current stage for another message", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/applications");
  await page
    .getByRole("button", { name: "Review The Browser Company" })
    .click();
  await page.getByRole("button", { name: "Not a move" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Not a move. The Browser Company stays Applied.",
  );
  await expect(page.getByText("Stage unchanged")).toHaveCount(0);
  await expect(page.locator(".stage-word").nth(4)).toHaveText("Applied");
  await expect(
    page.getByText(
      "The Browser Company · Application received · Outlook school",
    ),
  ).toBeVisible();

  await page.goto("/mailboxes");
  await page.goto("/applications");
  await expect(page.getByRole("status")).toHaveText(
    "Not a move. The Browser Company stays Applied.",
  );
  await expect(
    page.getByRole("button", { name: "Review The Browser Company" }),
  ).toHaveCount(0);
});

test("recognized email and the saving frames stay on the fixture", async ({
  page,
}) => {
  await signIn(page);

  await page.goto("/applications?review=recognized");
  await expect(page.getByRole("status")).toHaveText(
    "Fable moved to Offer from a recognized email.",
  );
  await expect(page.locator(".stage-word").first()).toHaveText("Offer");
  await expect(page.getByText("Stage unchanged")).toBeVisible();

  await page.goto("/applications?review=saving-confirm");
  const saving = page.getByRole("complementary", { name: "Move this stage?" });
  await expect(saving.locator(".review-stop.center")).toHaveText(
    "Interview not done",
  );
  await expect(saving.locator(".ticks")).toBeVisible();
  await expect(saving.locator(".review-stop.center")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(saving.getByRole("button", { name: "Not a move" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Stage unchanged")).toBeVisible();

  await page.goto("/applications?review=saving-not-a-move");
  const staying = page.getByRole("complementary", { name: "Move this stage?" });
  await expect(staying.locator(".review-stop.center")).toHaveText("Applied");
  await expect(staying.locator(".ticks")).toBeVisible();
  await expect(
    staying.getByText("Applied stays until this finishes."),
  ).toBeVisible();
  await expect(staying.getByText("Rejected")).toBeVisible();
  await expect(page.getByText("Stage unchanged")).toBeVisible();
});
