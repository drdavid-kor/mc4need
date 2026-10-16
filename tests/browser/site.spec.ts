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

test("signed-in browser downloads a private CLI identity file", async ({
  page,
  request,
}, info) => {
  test.skip(!!process.env.UI_BASE, "Private test runs only locally");
  const fixture = JSON.parse(
    fs.readFileSync("reports/private/local-fixture.json", "utf8"),
  );
  const response = await request.post("/api/auth/link", {
    headers: { Authorization: `Bearer ${fixture.ownerToken}` },
    data: {},
  });
  await page.goto((await response.json()).url);
  await expect(
    page.getByRole("button", { name: "下载私密凭证文件" }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载私密凭证文件" }).click();
  const download = await downloadPromise;
  const dest = info.outputPath("identity.json");
  await download.saveAs(dest);
  const credential = JSON.parse(fs.readFileSync(dest, "utf8"));
  expect(credential.userId).toBe(fixture.ownerId);
  expect(credential.token).toMatch(/^[a-f0-9]{64}$/);
  expect(await page.locator("body").innerText()).not.toContain(
    credential.token,
  );
  fs.unlinkSync(dest);
});

test("receipt has priority over a stale client status while preserving its source", async ({
  page,
}) => {
  test.skip(!!process.env.UI_BASE, "Synthetic lifecycle fixture is local only");
  const fixture = JSON.parse(
    fs.readFileSync("reports/private/workflow-fixture.json", "utf8"),
  );
  await page.goto(`/needs/${fixture.needId}`);
  await expect(page.locator(".support-panel .status-block")).toHaveText(
    "已完成 · 发起方已确认收餐与反馈",
  );
  await expect(
    page.locator(".support-panel").getByText(/赞助人客户端同步：等待付款/),
  ).toBeVisible();
  await expect(page.getByText("Later discrepancy reported")).toBeVisible();
  await expect(
    page.locator('iframe[title="公开收货地点地图"]'),
  ).toHaveAttribute("src", /marker=31%2C121/);
  expect(await page.locator("body").innerText()).not.toContain("LOCAL-PRIVATE");
});
