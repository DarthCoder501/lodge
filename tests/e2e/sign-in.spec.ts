import { expect, test, type Locator, type Page } from "@playwright/test";

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

async function noHorizontalScroll(page: Page) {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
}

test.describe("sign-in", () => {
  test("shows one primary action and keeps the fields together", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(1);
    await expect(page.getByRole("textbox")).toHaveCount(2);
    await expect(page.getByLabel("Email")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    await expect(
      page.getByRole("textbox", { name: "Password" }),
    ).toHaveAttribute("autocomplete", "current-password");
    await expect(
      page.getByRole("link", { name: "Create account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Show password" }),
    ).toHaveCount(0);

    const emailWell = page.locator(".well").first();
    const wellBox = await box(emailWell);
    expect(wellBox.height).toBe(64);
    await expect(page.getByLabel("Email")).toHaveCSS("font-size", "20px");

    await page.getByRole("textbox", { name: "Password" }).fill("a");
    const submit = await box(page.getByRole("button", { name: "Sign in" }));
    const show = await box(page.getByRole("button", { name: "Show password" }));
    const password = await box(page.getByRole("textbox", { name: "Password" }));
    expect(Math.min(submit.width, submit.height)).toBeGreaterThanOrEqual(44);
    expect(Math.min(show.width, show.height)).toBeGreaterThanOrEqual(24);
    const sideBySide = show.y < password.y + password.height;
    const gap = sideBySide
      ? show.x - (password.x + password.width)
      : show.y - (password.y + password.height);
    expect(gap).toBeGreaterThanOrEqual(8);

    const emailLabel = await box(page.locator("label[for='email']"));
    const email = await box(page.getByLabel("Email"));
    const passwordLabel = await box(page.locator("label[for='password']"));
    const labelGap = email.y - (emailLabel.y + emailLabel.height);
    const fieldGap = passwordLabel.y - (email.y + email.height);
    expect(labelGap).toBeGreaterThanOrEqual(0);
    expect(labelGap).toBeLessThan(fieldGap);

    const gmail = page.getByRole("checkbox", {
      name: "Read Gmail for applications",
    });
    await expect(gmail).not.toBeChecked();
    const outlook = page.getByRole("checkbox", {
      name: "Read Outlook for applications",
    });
    await expect(outlook).not.toBeChecked();
    const google = page.getByRole("button", { name: "Continue with Google" });
    const linkBox = await box(gmail);
    const googleBox = await box(google);
    expect(Math.min(linkBox.width, linkBox.height)).toBeGreaterThanOrEqual(24);
    expect(Math.min(googleBox.width, googleBox.height)).toBeGreaterThanOrEqual(
      44,
    );
    expect(linkBox.x - (googleBox.x + googleBox.width)).toBeGreaterThanOrEqual(
      8,
    );

    const [
      wellBackground,
      deskBackground,
      submitBackground,
      googleBackground,
      linkColor,
      promptColor,
    ] = await Promise.all([
      emailWell.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
      page
        .locator("main")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      page
        .getByRole("button", { name: "Sign in" })
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      google.evaluate((element) => getComputedStyle(element).backgroundColor),
      page
        .getByRole("link", { name: "Create account" })
        .evaluate((element) => getComputedStyle(element).color),
      page
        .locator(".alternate span")
        .evaluate((element) => getComputedStyle(element).color),
    ]);
    expect(wellBackground).not.toBe(deskBackground);
    expect(submitBackground).not.toBe(googleBackground);
    expect(linkColor).not.toBe(promptColor);
    await noHorizontalScroll(page);
  });

  test("shows a pending state while sign-in is still running", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("pending@example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("long-enough-1");
    await page.evaluate(() => {
      sessionStorage.removeItem("sawPending");
      const button = document.querySelector(
        "form.account button[type='submit']",
      );
      if (!button) return;
      new MutationObserver(() => {
        if (button.textContent?.includes("Signing in")) {
          sessionStorage.setItem("sawPending", "yes");
        }
      }).observe(button, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("sawPending")))
      .toBe("yes");
  });

  test("keeps typed values, starts a session, then signs out", async ({
    page,
  }) => {
    const email = `Person.${Date.now()}@Example.com`;
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("long-enough-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("status")).toBeVisible();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password" }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("#sign-in-error")).toHaveText(
      "Email or password is incorrect.",
    );
    await expect(page.locator(".well").first()).toHaveCSS(
      "background-color",
      "rgb(240, 213, 203)",
    );
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByRole("textbox", { name: "Password" })).toHaveValue(
      "wrong-password",
    );
    expect(
      (await page.context().cookies()).map((cookie) => cookie.name),
    ).not.toContain("session");

    await page.getByRole("textbox", { name: "Password" }).fill("long-enough-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("status")).toHaveText(
      `Signed in as ${email.toLowerCase()}.`,
    );
    await expect(
      page.getByRole("heading", { name: "Signed in" }),
    ).toBeVisible();
    await expect(page.locator("main").getByRole("button")).toHaveCount(1);
    const signOut = await box(page.getByRole("button", { name: "Sign out" }));
    expect(Math.min(signOut.width, signOut.height)).toBeGreaterThanOrEqual(44);
    const session = (await page.context().cookies()).find(
      (cookie) => cookie.name === "session",
    );
    expect(session?.httpOnly).toBe(true);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in\?out=1$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("You’re signed out.");
    expect(
      (await page.context().cookies()).map((cookie) => cookie.name),
    ).not.toContain("session");
  });

  test("leaves for Google with the latch off and keeps Microsoft on the page", async ({
    page,
  }) => {
    const microsoft: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("microsoft")) microsoft.push(request.url());
    });
    await page.route("**/sign-in/google**", () => new Promise(() => {}));
    await page.goto("/sign-in");
    await expect(
      page.getByRole("checkbox", { name: "Read Gmail for applications" }),
    ).not.toBeChecked();

    const google = page.waitForRequest("**/sign-in/google**");
    await page
      .getByRole("button", { name: "Continue with Google" })
      .click({ noWaitAfter: true });
    await expect(
      page.getByRole("heading", { name: "Continuing to Google" }),
    ).toBeVisible();
    expect((await google).url()).not.toContain("linkAsMailbox");

    await page.goto("/sign-in");
    await page
      .getByRole("checkbox", { name: "Read Gmail for applications" })
      .check();
    const linked = page.waitForRequest("**/sign-in/google**");
    await page
      .getByRole("button", { name: "Continue with Google" })
      .click({ noWaitAfter: true });
    expect((await linked).url()).toContain("linkAsMailbox=true");

    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Continue with Microsoft" }).click();
    await expect(
      page.getByRole("heading", { name: "Continuing to Microsoft" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Back to sign in" }),
    ).toBeVisible();
    expect(microsoft).toEqual([]);
    await page.getByRole("button", { name: "Back to sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });

  test("shows the return frame", async ({ page }) => {
    await page.goto("/sign-in?return=1");
    await expect(
      page.getByRole("heading", { name: "Finishing sign-in" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(
      "If this email already has an account, your applications stay.",
    );
  });

  test("fits a phone width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/sign-in");
    const submit = await box(page.getByRole("button", { name: "Sign in" }));
    expect(Math.min(submit.width, submit.height)).toBeGreaterThanOrEqual(44);
    await noHorizontalScroll(page);
  });
});
