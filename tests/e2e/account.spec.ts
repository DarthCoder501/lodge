import { expect, test, type Page } from "@playwright/test";

const password = "long-enough-1";

async function noHorizontalScroll(page: Page) {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
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
  await expect(page.getByRole("status")).toHaveText(
    `Signed in as ${email.toLowerCase()}.`,
  );
}

test("no session leaves the account page for sign-in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
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

    await expect(
      pageA.getByRole("heading", { name: "Your account" }),
    ).toBeVisible();
    await expect(pageA.locator("main .address")).toHaveText(
      emailA.toLowerCase(),
    );
    await expect(pageA.getByText("Not verified")).toBeVisible();
    await expect(pageA.getByText(emailB.toLowerCase())).toHaveCount(0);
    await expect(pageA.locator("main").getByRole("button")).toHaveText(
      "Send a new link",
    );

    await expect(pageB.locator("main .address")).toHaveText(
      emailB.toLowerCase(),
    );
    await expect(pageB.getByText(emailA.toLowerCase())).toHaveCount(0);
    await noHorizontalScroll(pageA);
    await noHorizontalScroll(pageB);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

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

test("the account slab and the alert bolt match their frames", async ({
  page,
}) => {
  const pushed: string[] = [];
  page.on("request", (request) => {
    if (/push|fcm|notification/i.test(request.url()))
      pushed.push(request.url());
  });
  await page.addInitScript(() => {
    const mark = window as Window & { __push?: boolean; __ask?: boolean };
    mark.__push = false;
    mark.__ask = false;
    try {
      PushManager.prototype.subscribe = () => {
        mark.__push = true;
        return Promise.reject(new Error("no push"));
      };
    } catch {
      mark.__push = false;
    }
    try {
      Notification.requestPermission = () => {
        mark.__ask = true;
        return Promise.resolve("default");
      };
    } catch {
      mark.__ask = false;
    }
  });

  const email = `account.${Date.now()}@example.com`;
  await createAndSignIn(page, email);
  await page.goto("/applications");
  await page.goto("/account");
  await expect(page.getByText("Not verified")).toBeVisible();
  await expect(
    page.getByText(`A link is with ${email}. It lasts 24 hours.`),
  ).toBeVisible();
  await expect(
    page.getByText("Verify your email before connecting one"),
  ).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(1);
  const send = page.getByRole("button", { name: "Send a new link" });
  const back = page.getByRole("link", { name: "Back to applications" });
  const [
    sendBox,
    backBox,
    deskBackground,
    slabBackground,
    titleColor,
    quietColor,
  ] = await Promise.all([
    send.boundingBox(),
    back.boundingBox(),
    page
      .locator("main.desk")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    page
      .locator(".slab")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    page
      .locator("a.slab .row-title")
      .first()
      .evaluate((element) => getComputedStyle(element).color),
    page
      .locator(".quiet")
      .evaluate((element) => getComputedStyle(element).color),
  ]);
  expect(sendBox).not.toBeNull();
  expect(backBox).not.toBeNull();
  expect(Math.min(sendBox!.width, sendBox!.height)).toBeGreaterThanOrEqual(44);
  expect(Math.min(backBox!.width, backBox!.height)).toBeGreaterThanOrEqual(24);
  expect(sendBox!.y + sendBox!.height).toBeLessThan(backBox!.y);
  expect(slabBackground).not.toBe(deskBackground);
  expect(titleColor).not.toBe(quietColor);
  await expect(page.getByRole("link", { name: /docs/i })).toHaveCount(0);
  await send.click();
  await expect(page.getByText("Not verified")).toBeVisible();

  await verify(page, email);
  await page.goto("/account");
  await expect(page.locator("main .address")).toHaveText(email);
  await expect(page.getByText("Verified")).toBeVisible();
  await expect(page.getByText("Gmail and Outlook")).toBeVisible();
  await expect(page.getByText("A link is with")).toHaveCount(0);
  await expect(page.locator("main .primary")).toHaveCount(0);
  const addressSize = await page
    .locator(".address")
    .evaluate((element) => getComputedStyle(element).fontSize);
  expect(addressSize).toBe("22px");

  await page.goto("/account?alerts=off");
  await expect(
    page.getByRole("heading", { name: "Push alerts" }),
  ).toBeVisible();
  await expect(page.getByText("Off until you turn them on")).toBeVisible();
  await expect(page.getByText("You choose")).toBeVisible();
  await expect(page.getByText("Alerts never include the email.")).toBeVisible();
  const bolt = page.getByRole("button", {
    name: "Off until you turn them on You choose",
  });
  const boltBox = await bolt.boundingBox();
  expect(boltBox).not.toBeNull();
  expect(Math.min(boltBox!.width, boltBox!.height)).toBeGreaterThanOrEqual(44);
  await bolt.click();
  await expect(
    page.getByRole("complementary", { name: "The browser will ask" }),
  ).toBeVisible();
  await expect(
    page.getByText("Alerts stay off unless you allow them."),
  ).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(1);
  const continueBox = await page
    .getByRole("button", { name: "Continue" })
    .boundingBox();
  const cancelBox = await page
    .getByRole("button", { name: "Cancel" })
    .boundingBox();
  expect(continueBox).not.toBeNull();
  expect(cancelBox).not.toBeNull();
  expect(
    Math.min(continueBox!.width, continueBox!.height),
  ).toBeGreaterThanOrEqual(44);
  expect(Math.min(cancelBox!.width, cancelBox!.height)).toBeGreaterThanOrEqual(
    24,
  );
  expect(continueBox!.y + continueBox!.height).toBeLessThan(cancelBox!.y);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("You choose")).toBeVisible();

  await bolt.click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("status")).toHaveText(/Waiting on the browser/);
  await expect(page.getByRole("status")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".ticks span")).toHaveCount(3);
  await expect(
    page.getByText("This prompt belongs to the browser."),
  ).toBeVisible();
  await expect(page.locator("main .primary")).toHaveCount(1);
  await page.getByRole("button", { name: "Allow" }).click();
  await expect(page.getByText("On", { exact: true })).toBeVisible();
  await expect(
    page.getByText("The browser allowed notifications"),
  ).toBeVisible();
  await expect(
    page.getByText("Turning this off keeps applications syncing."),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as Window & { __push?: boolean }).__push),
  ).toBe(false);
  expect(
    await page.evaluate(() => (window as Window & { __ask?: boolean }).__ask),
  ).toBe(false);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      `lodge-alerts:${email}`,
    ),
  ).toBe("on");
  await page.goto("/applications");
  await page.goto("/account");
  await expect(page.getByText("On", { exact: true })).toBeVisible();

  await page.goto("/account?alerts=on");
  await page
    .getByRole("button", { name: "On The browser allowed notifications" })
    .click();
  await expect(page.getByText("Off until you turn them on")).toBeVisible();
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      `lodge-alerts:${email}`,
    ),
  ).toBe("off");

  await page.goto("/account?alerts=denied");
  await expect(
    page.getByText("The browser blocked notifications"),
  ).toBeVisible();
  await expect(
    page.getByText("Allow notifications in the browser, then check again."),
  ).toBeVisible();
  await expect(page.locator("main .primary")).toHaveText(
    "Check permission again",
  );
  await page.getByRole("button", { name: "Check permission again" }).click();
  await expect(page.getByText("Permission pending")).toBeVisible();
  await page.getByRole("button", { name: "Block" }).click();
  await expect(
    page.getByText("The browser blocked notifications"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      `lodge-alerts:${email}`,
    ),
  ).toBe("denied");

  await page.goto("/account?alerts=pending");
  await expect(page.getByText("Still off")).toBeVisible();
  await expect(page.getByText("Show notifications")).toBeVisible();
  expect(pushed.filter((url) => !url.includes("/_next/"))).toEqual([]);

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/account?alerts=ask");
  await expect(
    page.getByRole("heading", { name: "The browser will ask" }),
  ).toBeVisible();
  await noHorizontalScroll(page);
});
