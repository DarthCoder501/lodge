import { expect, test, type Page } from "@playwright/test";

const password = "long-enough-1";

async function signIn(page: Page, email: string) {
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

async function verify(page: Page, email: string) {
  const response = await page.request.get(
    `/verify/outbox?email=${encodeURIComponent(email)}`,
  );
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { link: string };
  await page.goto(body.link);
  await expect(
    page.getByRole("heading", { name: "Your email is verified" }),
  ).toBeVisible();
}

test("fixture mailboxes and the verification gate match their frames", async ({
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

  const email = `boxes.${Date.now()}@example.com`;
  await signIn(page, email);

  await page.goto("/mailboxes?status=none");
  await expect(
    page.getByRole("heading", { name: "Your mailboxes" }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Verify your email before a mailbox can connect.",
  );
  await expect(page.getByText(`A link is with ${email}`)).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(1);
  const send = page.getByRole("button", { name: "Send a new link" });
  const back = page.getByRole("link", { name: "Back to applications" });
  const gmail = page.getByRole("button", { name: "Connect Gmail" });
  const outlook = page.getByRole("button", { name: "Connect Outlook" });
  await expect(gmail).toBeDisabled();
  await expect(outlook).toBeDisabled();
  const [sendBox, backBox, gmailBox, outlookBox] = await Promise.all([
    send.boundingBox(),
    back.boundingBox(),
    gmail.boundingBox(),
    outlook.boundingBox(),
  ]);
  expect(sendBox).not.toBeNull();
  expect(backBox).not.toBeNull();
  expect(gmailBox).not.toBeNull();
  expect(outlookBox).not.toBeNull();
  expect(Math.min(sendBox!.width, sendBox!.height)).toBeGreaterThanOrEqual(44);
  expect(Math.min(backBox!.width, backBox!.height)).toBeGreaterThanOrEqual(24);
  expect(gmailBox!.y + gmailBox!.height).toBeLessThan(outlookBox!.y);
  await send.click();
  await expect(page).toHaveURL(/\/mailboxes/);
  await expect(page.locator("main").getByRole("alert")).toBeVisible();

  await page.goto("/applications");
  await page.goto("/mailboxes");
  await expect(page.getByText(`A link is with ${email}`)).toBeVisible();

  await verify(page, email);
  await page.goto("/mailboxes");
  await expect(page.locator(".address")).toHaveText([
    "maya.chen@gmail.com",
    "mchen@northwestern.edu",
  ]);
  await expect(page.getByText("Gmail · Connected")).toBeVisible();
  await expect(page.getByText("Outlook · Connected")).toBeVisible();
  await expect(page.getByText("Another inbox is optional.")).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(0);
  const address = page.locator(".address").first();
  const size = await address.evaluate(
    (element) => getComputedStyle(element).fontSize,
  );
  expect(size).toBe("20px");
  const [deskBackground, rowBackground, disconnectColor, metaColor] =
    await Promise.all([
      page
        .locator("main.desk")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      page
        .locator(".row")
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      page
        .locator(".disconnect")
        .first()
        .evaluate((element) => getComputedStyle(element).color),
      page
        .locator(".meta")
        .first()
        .evaluate((element) => getComputedStyle(element).color),
    ]);
  expect(rowBackground).not.toBe(deskBackground);
  expect(disconnectColor).not.toBe(metaColor);

  await page.getByRole("button", { name: "Connect Gmail" }).click();
  await expect(page).toHaveURL(/\/mailboxes$/);
  expect(providers).toEqual([]);

  await page.goto("/mailboxes?status=one");
  await expect(page.locator(".address")).toHaveText(["maya.chen@gmail.com"]);

  await page.goto("/mailboxes?status=none");
  await expect(
    page.getByRole("heading", { name: "No mailbox yet" }),
  ).toBeVisible();
  await expect(page.getByText("Your email is verified.")).toBeVisible();
  await expect(page.locator(".address")).toHaveCount(0);
  await expect(page.locator("main .primary")).toHaveCount(0);
  const [emptyBackground] = await Promise.all([
    page
      .locator(".empty")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(emptyBackground).not.toBe(deskBackground);

  await page.goto("/mailboxes?status=loading");
  await expect(page.getByText("Loading your mailboxes")).toBeVisible();
  await expect(page.locator(".ticks span")).toHaveCount(3);
  await expect(page.locator(".address")).toHaveCount(0);
  await expect(page.locator("main .primary")).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 800 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(false);
  expect(providers).toEqual([]);
});
