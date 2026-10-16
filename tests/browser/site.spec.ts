import { test, expect } from "@playwright/test";
import fs from "node:fs";
test("public discovery, demo, prompt and responsive layout", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sponsor a meal. Be part of it." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "演示案例", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".card h3 a").first().click();
  await expect(
    page.getByText("这是一份虚构场景演示 · Simulated example"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "支持这顿饭" })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "我也有一份需要" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("可复制的 AI 指引")).toContainText(
    "不要索取或上传麦当劳 Token",
  );
  await page
    .getByRole("button", { name: "复制完整指引 / Copy prompt" })
    .click();
  await expect(
    page.getByRole("button", { name: "已复制，粘贴到你的 AI 即可" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page.getByText("从你的 AI 回到这里")).toBeVisible();
  await page.goto("/guide");
  await page.getByText("什么时候算完成？", { exact: true }).click();
  await expect(
    page.getByText(
      "只有发起方确认实际收餐并返回反馈，才成为完成案例。麦当劳订单状态完成不直接等于平台完成。",
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("one-use web login accesses only own order messages", async ({
  page,
  request,
}) => {
  test.skip(!!process.env.UI_BASE, "Mutation tests only run locally");
  const fixture = JSON.parse(
    fs.readFileSync("reports/private/local-fixture.json", "utf8"),
  );
  const r = await request.post("/api/auth/link", {
    headers: { Authorization: `Bearer ${fixture.ownerToken}` },
    data: {},
  });
  expect(r.ok()).toBe(true);
  const link = (await r.json()).url;
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "我的记录 My space" }),
  ).toBeVisible();
  expect(page.url()).not.toContain("#");
  await page.goto(`/orders/${fixture.attemptId}`);
  await expect(page.getByText("订单详情与联系")).toBeVisible();
  const note = "UI test message " + crypto.randomUUID();
  await page.getByLabel("给对方留言").fill(note);
  await page.getByRole("button", { name: "发送留言" }).click();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
});
