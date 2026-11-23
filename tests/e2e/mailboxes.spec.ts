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

test("connect cancels and disconnect removes the fixture row for the session", async ({
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

  const email = `connect.${Date.now()}@example.com`;
  await signIn(page, email);
  await verify(page, email);
  await page.goto("/mailboxes");

  await page.getByRole("button", { name: "Connect Gmail" }).click();
  await expect(
    page.getByRole("heading", { name: "Connecting Gmail" }),
  ).toBeVisible();
  await expect(
    page.getByText("Finish at Google. This inbox is not connected yet."),
  ).toBeVisible();
  await expect(page.locator(".mail")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".ticks span")).toHaveCount(3);
  const cancel = page.getByRole("button", { name: "Cancel connection" });
  const cancelBox = await cancel.boundingBox();
  expect(cancelBox).not.toBeNull();
  expect(Math.min(cancelBox!.width, cancelBox!.height)).toBeGreaterThanOrEqual(
    44,
  );
  await expect(page).toHaveURL(/\/mailboxes$/);
  await cancel.click();
  await expect(page.locator(".address")).toHaveText([
    "maya.chen@gmail.com",
    "mchen@northwestern.edu",
  ]);

  await page
    .getByRole("button", { name: "Disconnect maya.chen@gmail.com" })
    .click();
  const sheet = page.getByRole("complementary", {
    name: "Disconnect this mailbox?",
  });
  await expect(sheet.getByText("maya.chen@gmail.com")).toBeVisible();
  await expect(
    sheet.getByText("Sync stops. Applications stay. Outlook stays connected."),
  ).toBeVisible();
  const drop = sheet.getByRole("button", { name: "Disconnect mailbox" });
  const quiet = sheet.getByRole("button", { name: "Cancel" });
  const [
    dropBox,
    quietBox,
    deskBackground,
    sheetBackground,
    dropColor,
    quietColor,
  ] = await Promise.all([
    drop.boundingBox(),
    quiet.boundingBox(),
    page
      .locator("main.desk")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    sheet.evaluate((element) => getComputedStyle(element).backgroundColor),
    drop.evaluate((element) => getComputedStyle(element).color),
    quiet.evaluate((element) => getComputedStyle(element).color),
  ]);
  expect(dropBox).not.toBeNull();
  expect(quietBox).not.toBeNull();
  expect(Math.min(dropBox!.width, dropBox!.height)).toBeGreaterThanOrEqual(44);
  expect(Math.min(quietBox!.width, quietBox!.height)).toBeGreaterThanOrEqual(
    24,
  );
  expect(quietBox!.y).toBeGreaterThan(dropBox!.y + dropBox!.height);
  expect(sheetBackground).not.toBe(deskBackground);
  expect(dropColor).not.toBe(quietColor);
  await expect(page.locator("main .drop")).toHaveCount(1);
  await expect(page.locator("main .primary")).toHaveCount(0);
  await quiet.click();
  await expect(page.locator(".address")).toHaveCount(2);

  await page
    .getByRole("button", { name: "Disconnect maya.chen@gmail.com" })
    .click();
  await page.getByRole("button", { name: "Disconnect mailbox" }).click();
  await expect(page).toHaveURL(/\/mailboxes$/);
  await expect(page.locator(".address")).toHaveText(["mchen@northwestern.edu"]);
  await expect(page.getByRole("status")).toHaveText(
    "Gmail stopped syncing. Applications stay. Outlook is still connected.",
  );
  await expect(page.locator("main .primary")).toHaveCount(0);

  await page.goto("/applications");
  await page.goto("/mailboxes");
  await expect(page.locator(".address")).toHaveText(["mchen@northwestern.edu"]);
  await expect(page.getByRole("status")).toHaveText(
    "Gmail stopped syncing. Applications stay. Outlook is still connected.",
  );
  expect(providers).toEqual([]);
});

test("connecting, disconnect, and provider link frames stay on the fixture", async ({
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

  const email = `frames.${Date.now()}@example.com`;
  await signIn(page, email);
  await verify(page, email);

  await page.goto("/mailboxes?connect=outlook");
  await expect(
    page.getByRole("heading", { name: "Connecting Outlook" }),
  ).toBeVisible();
  await expect(
    page.getByText("Finish at Microsoft. This inbox is not connected yet."),
  ).toBeVisible();
  await expect(page.locator(".mail")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".ticks span")).toHaveCount(3);
  await expect(page.locator(".address")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel connection" }).click();
  await expect(page.locator(".address")).toHaveCount(2);

  await page.goto("/mailboxes?disconnect=gmail");
  await expect(
    page.getByRole("complementary", { name: "Disconnect this mailbox?" }),
  ).toBeVisible();
  await expect(page.locator(".address")).toHaveText([
    "maya.chen@gmail.com",
    "mchen@northwestern.edu",
  ]);
  await expect(page.getByText("Another inbox is optional.")).toHaveCount(0);

  await page.goto("/mailboxes?disconnecting=gmail");
  await expect(page.getByText("Gmail · Disconnecting")).toBeVisible();
  await expect(page.getByText("Outlook · Connected")).toBeVisible();
  const dropping = page.getByRole("button", { name: "Disconnecting" });
  await expect(dropping).toHaveAttribute("aria-busy", "true");
  await expect(dropping.locator(".ticks span")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Disconnect maya.chen@gmail.com" }),
  ).toHaveCount(0);

  await page.goto("/mailboxes?link=off");
  await expect(
    page.getByText(`Signed in as ${email}. No mailbox is linked.`),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No mailbox yet" }),
  ).toBeVisible();
  await expect(page.getByText("Your email is verified.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toHaveCSS(
    "justify-content",
    "center",
  );

  await page.goto("/mailboxes?link=in");
  await expect(
    page.getByText("Gmail is connected and syncing. You can leave this page."),
  ).toBeVisible();
  await expect(page.getByText("Gmail · Syncing")).toBeVisible();
  await expect(page.locator(".address")).toHaveText(["maya.chen@gmail.com"]);
  await expect(page.getByRole("button", { name: /Disconnect/ })).toHaveCount(0);
  await expect(page.locator(".row .ticks span")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toHaveCSS(
    "justify-content",
    "flex-start",
  );
  const syncingInlay = await page
    .locator(".inlay")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole("button", { name: "Connect Outlook" }).click();
  await expect(
    page.getByRole("heading", { name: "Connecting Outlook" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/link=in/);
  await page.getByRole("button", { name: "Cancel connection" }).click();

  await page.goto("/mailboxes");
  const connectedInlay = await page
    .locator(".inlay")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(syncingInlay).not.toBe(connectedInlay);
  expect(providers).toEqual([]);

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/mailboxes?disconnect=gmail");
  await expect(
    page.getByRole("button", { name: "Disconnect mailbox" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(false);
});
