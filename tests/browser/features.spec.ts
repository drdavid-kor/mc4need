import { test, expect } from "@playwright/test";
import fs from "node:fs";
test("English public pages, demo stories, language persistence and mainland China scope", async ({
  page,
}) => {
  for (const path of [
    "/?lang=en",
    "/guide",
    "/privacy",
    "/dashboard",
    "/needs/demo-birthday",
    "/needs/demo-training",
    "/needs/demo-basketball",
    "/not-found",
  ]) {
    await page.goto(path);
    if (path.includes("/needs/"))
      await expect(page.locator(".detail h1")).toBeVisible();
    if (path.startsWith("/?")) {
      await page
        .getByRole("button", { name: "Demo cases", exact: true })
        .click();
      await expect(page.locator(".card")).toHaveCount(3);
    }
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const body = (await page.locator("body").innerText()).replaceAll(
      "中文",
      "",
    );
    expect(body.match(/[\p{Script=Han}]/gu), path).toBeNull();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
  }
  await page.goto("/?lang=en");
  await expect(
    page.getByText("Service area: mainland China · Prices in CNY"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Switch language / 切换语言" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
});
test("supporter entry copies a read-only scheduling prompt with one click", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?lang=en");
  await page
    .getByRole("button", { name: "Follow meal needs", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copied · paste into your AI" }),
  ).toBeVisible();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toContain("persistent scheduling tool");
  expect(prompt).toContain("no McDonald");
  expect(prompt).toContain("only match non-demo");
  expect(prompt).toContain("do not pretend");
  expect(prompt).toContain("mainland China");
  expect(prompt).toContain("previously notified need IDs");
  expect(new URL(page.url()).hash).toBe("");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "I need meal support", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "optionally upload a cover",
  );
});
test("clipboard denial exposes a selectable prompt and does not claim a task exists", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
    document.execCommand = () => false;
  });
  await page.goto("/?lang=en");
  await page
    .getByRole("button", { name: "Follow meal needs", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy full instructions" }).click();
  await expect(
    page.getByText(
      "Automatic copying was blocked. The instructions are selected; please copy them manually.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Copyable AI instructions")).toBeFocused();
});
test("requester uploads, previews and removes a cover; other uses the general illustration", async ({
  page,
  request,
}) => {
  test.skip(
    !!process.env.UI_BASE,
    "Synthetic upload only on local test database",
  );
  const owner = await (
    await request.post("/api/auth/guest", { data: {} })
  ).json();
  const headers = { Authorization: "Bearer " + owner.token };
  const n = await (
    await request.post("/api/needs", {
      headers,
      data: {
        title: "Browser cover test",
        story: "Synthetic test only",
        organizer: "Test",
        scene: "other",
        meals: [{ name: "Test", quantity: 1, specification: "No order" }],
        location: { name: "Test", address: "Public test", lat: 31, lng: 121 },
        mealAt: Date.now() + 3600000,
        acceptBy: Date.now() + 1800000,
        referenceCents: null,
        referenceAt: null,
        recurringDays: null,
        privateDelivery: { contactName: "Test", phone: "PRIVATE", detail: "" },
        consent: true,
        deliveryCheckedAt: Date.now(),
      },
    })
  ).json();
  await page.goto("/?lang=en");
  const link2 = await (
    await request.post("/api/auth/link", { headers, data: {} })
  ).json();
  await page.goto(link2.url);
  await expect(page.locator(".record").first()).toBeVisible();
  await page.getByText("Manage cover", { exact: true }).click();
  const editor = page.locator(".cover-editor");
  await expect(editor.locator("img")).toHaveAttribute(
    "src",
    "/images/covers/other.webp",
  );
  await editor
    .locator("input[type=file]")
    .setInputFiles("public/images/covers/training.webp");
  await expect(editor.locator("img")).toHaveAttribute("src", /^blob:/);
  await expect(
    editor.getByRole("button", { name: "Save cover" }),
  ).toBeDisabled();
  await editor.getByRole("checkbox").check();
  await editor.getByRole("button", { name: "Save cover" }).click();
  await expect(editor.getByText("Cover updated")).toBeVisible();
  await expect(editor.locator("img")).toHaveAttribute(
    "src",
    new RegExp(`/api/private/needs/${n.id}/cover`),
  );
  await expect
    .poll(() =>
      editor
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await editor
    .getByRole("button", {
      name: "Remove image and use the default illustration",
    })
    .click();
  await expect(editor.locator("img")).toHaveAttribute(
    "src",
    "/images/covers/other.webp",
  );
});
