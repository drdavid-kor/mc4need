import { validCover } from "./covers";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import {
  now,
  id,
  token,
  hash,
  seal,
  unseal,
  needSchema,
  quoteSchema,
  syncSchema,
  payDeadline,
  classifySync,
  paidStates,
} from "./core";
type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_SECRET: string;
  PUBLIC_ORIGIN: string;
  PAYMENT_WINDOW_SECONDS: string;
  QUOTE_LOCK_SECONDS: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
};
type User = {
  id: string;
  email: string | null;
  email_notifications: number;
  admin: number;
};
const app = new Hono<{ Bindings: Env; Variables: { user: User } }>();
class Problem extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (s: number, m: string): never => {
  throw new Problem(s, m);
};
const one = async (c: any, sql: string, ...args: any[]) =>
  c.env.DB.prepare(sql)
    .bind(...args)
    .first();
const run = async (c: any, sql: string, ...args: any[]) =>
  c.env.DB.prepare(sql)
    .bind(...args)
    .run();
const all = async (c: any, sql: string, ...args: any[]) =>
  (
    await c.env.DB.prepare(sql)
      .bind(...args)
      .all()
  ).results;
const body = async (c: any, schema: any) => {
  const raw = await c.req.text();
  if (raw.length > 20000) fail(413, "内容过长");
  return schema.parse(JSON.parse(raw || "{}"));
};
const audit = async (c: any, action: string, target: string) =>
  run(
    c,
    "INSERT INTO audit(user_id,action,target,created_at) VALUES(?,?,?,?)",
    c.get("user")?.id ?? null,
    action,
    target,
    now(),
  );
async function notify(c: any, userId: string, needId: string, message: string) {
  const nid = id();
  await run(
    c,
    "INSERT INTO notifications(id,user_id,need_id,body,created_at) VALUES(?,?,?,?,?)",
    nid,
    userId,
    needId,
    message,
    now(),
  );
  const user = await one(
    c,
    "SELECT email,email_notifications FROM users WHERE id=?",
    userId,
  );
  if (user?.email && user.email_notifications && c.env.RESEND_API_KEY) {
    let result = "failed";
    try {
      await sendMail(
        c.env,
        user.email,
        "Mc4Need · 新消息",
        `${message}\n\n打开 Mc4Need 查看：https://mc4need.david-widgets.com/dashboard`,
      );
      result = "sent";
    } catch {}
    await run(
      c,
      "UPDATE notifications SET email_status=? WHERE id=?",
      result,
      nid,
    );
  }
}
async function emailRate(c: any, email: string) {
  const key = await hash(
    `${c.env.APP_SECRET}:email:${email}:${Math.floor(now() / 900000)}`,
  );
  const r = await one(
    c,
    "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    key,
    now() + 1800000,
  );
  if (r.count > 3) fail(429, "请稍后再申请邮件验证或恢复");
}
async function sendMail(env: Env, to: string, subject: string, text: string) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM)
    fail(503, "邮件服务尚未启用，站内消息仍可使用");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
  });
  if (!r.ok) fail(503, "邮件发送失败，请稍后再试");
}
async function session(c: any, userId: string, kind = "cli") {
  const t = token();
  await run(
    c,
    "INSERT INTO sessions(hash,user_id,expires_at,kind) VALUES(?,?,?,?)",
    await hash(t),
    userId,
    now() + (kind === "web" ? 7 : 90) * 86400000,
    kind,
  );
  return t;
}
async function need(c: any, nid: string) {
  const n = await one(c, "SELECT * FROM needs WHERE id=?", nid);
  if (!n) fail(404, "未找到需求");
  return n;
}
async function owner(c: any, nid: string) {
  const n = await need(c, nid);
  if (n.owner_id !== c.get("user").id) fail(403, "仅发起方可操作");
  return n;
}
async function member(c: any, aid: string) {
  const a = await one(c, "SELECT * FROM attempts WHERE id=?", aid);
  if (!a) fail(404, "未找到赞助记录");
  const n = await need(c, a.need_id);
  if (a.sponsor_id !== c.get("user").id && n.owner_id !== c.get("user").id)
    fail(403, "仅订单双方可访问");
  return { a, n };
}
async function sponsor(c: any, aid: string) {
  const m = await member(c, aid);
  if (m.a.sponsor_id !== c.get("user").id) fail(403, "仅赞助人可操作");
  return m;
}
function publicNeed(n: any, a?: any) {
  return {
    id: n.id,
    coverUrl: n.cover_revision
      ? `/api/needs/${n.id}/cover?v=${n.cover_revision}`
      : null,
    coverRevision: n.cover_revision ?? null,
    version: n.version,
    status: n.status,
    hidden: !!n.hidden,
    demo: !!n.demo,
    ...JSON.parse(n.data),
    createdAt: n.created_at,
    updatedAt: n.updated_at,
    receivedAt: n.received_at,
    feedback: n.feedback,
    completedAt: n.completed_at,
    issue: n.issue,
    progress: a
      ? {
          state: a.state,
          name: a.display_name,
          lastSync: a.last_sync,
          source: "赞助人客户端同步",
          payBy: a.pay_by,
          cancelRequested: !!a.cancel_requested_at,
          cancelResult: a.cancel_result,
          refundState: a.refund_state,
          issue: a.issue,
        }
      : null,
  };
}
async function cleanup(env: Env) {
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE attempts SET active=0,state='released',updated_at=? WHERE state='quoting' AND active=1 AND lock_until<?",
    ).bind(now(), now()),
    env.DB.prepare(
      "UPDATE needs SET status='closed',updated_at=? WHERE status IN ('open','update') AND accept_by<? AND NOT EXISTS(SELECT 1 FROM attempts WHERE need_id=needs.id AND active=1)",
    ).bind(now(), now()),
    env.DB.prepare(
      "UPDATE attempts SET state='uncertain',issue='付款时限已过，请查询官方订单是否已付款、取消或失效；当前仍保留占用',revision=revision+1,updated_at=? WHERE active=1 AND state='pending' AND pay_by<?",
    ).bind(now(), now()),
    env.DB.prepare("DELETE FROM rate_limits WHERE expires_at<?").bind(now()),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now()),
    env.DB.prepare("DELETE FROM login_links WHERE expires_at<?").bind(now()),
    env.DB.prepare("DELETE FROM email_tokens WHERE expires_at<?").bind(now()),
  ]);
}
async function makeNext(env: Env, n: any) {
  const data = JSON.parse(n.data),
    delta = n.recurring_days * 86400000;
  Object.assign(data, {
    mealAt: data.mealAt + delta,
    acceptBy: data.acceptBy + delta,
    deliveryCheckedAt: 0,
    referenceAt: null,
    referenceCents: null,
  });
  const nid = id();
  const r = await env.DB.prepare(
    "INSERT OR IGNORE INTO needs(id,owner_id,data,private_data,created_at,updated_at,accept_by,recurring_days,parent_id) VALUES(?,?,?,?,?,?,?,?,?)",
  )
    .bind(
      nid,
      n.owner_id,
      JSON.stringify(data),
      n.private_data,
      now(),
      now(),
      data.acceptBy,
      n.recurring_days,
      n.id,
    )
    .run();
  if (r.meta.changes) {
    await env.DB.prepare(
      "INSERT INTO notifications(id,user_id,need_id,body,created_at) VALUES(?,?,?,?,?)",
    )
      .bind(
        id(),
        n.owner_id,
        nid,
        "下一期草稿已生成，请重新核实餐食与配送并确认发布。",
        now(),
      )
      .run();
    return nid;
  }
  return (await env.DB.prepare("SELECT id FROM needs WHERE parent_id=?")
    .bind(n.id)
    .first<any>())!.id;
}
async function scheduledMaintenance(env: Env) {
  await cleanup(env);
  const rows = await env.DB.prepare(
    "SELECT * FROM needs WHERE demo=0 AND hidden=0 AND recurring_days IS NOT NULL AND status!='draft' AND json_extract(data,'$.mealAt')<=? AND NOT EXISTS(SELECT 1 FROM needs child WHERE child.parent_id=needs.id) LIMIT 100",
  )
    .bind(now())
    .all();
  for (const n of rows.results) await makeNext(env, n);
}
app.use("/api/*", async (c, next) =>
  bodyLimit({
    maxSize:
      c.req.method === "PUT" && /^\/api\/needs\/[^/]+\/cover$/.test(c.req.path)
        ? 400000
        : 20000,
    onError: (c) => c.json({ error: "内容过长" }, 413),
  })(c, next),
);
app.use("/api/*", async (c, next) => {
  if (!c.env.APP_SECRET || c.env.APP_SECRET.length < 32)
    fail(503, "服务配置未就绪");
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Frame-Options", "DENY");
  const origin = c.req.header("Origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
    origin &&
    origin !== new URL(c.req.url).origin
  )
    fail(403, "跨站请求被拒绝");
  if (!["GET", "HEAD"].includes(c.req.method)) {
    const key = await hash(
      `${c.env.APP_SECRET}:${c.req.header("CF-Connecting-IP") ?? "local"}:${Math.floor(now() / 60000)}`,
    );
    const row = await one(
      c,
      "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
      key,
      now() + 120000,
    );
    if (row.count > 90) fail(429, "操作过于频繁，请稍后重试");
  }
  await next();
});
app.onError((e, c) => {
  if (e instanceof Problem)
    return c.json({ error: e.message }, e.status as any);
  if (e instanceof z.ZodError || e instanceof SyntaxError)
    return c.json(
      {
        error: "输入格式有误",
        details:
          e instanceof z.ZodError
            ? e.issues.map((i) => ({ path: i.path, message: i.message }))
            : undefined,
      },
      400,
    );
  if (/UNIQUE constraint/.test(e.message))
    return c.json({ error: "记录已存在或已被其他人承担，请刷新后重试" }, 409);
  console.error("api_error", e.name);
  return c.json({ error: "服务暂时不可用，请稍后重试" }, 500);
});
app.get("/api/health", async (c) => {
  await one(c, "SELECT 1");
  return c.json({
    ok: true,
    version: "0.2.0",
    email: !!(c.env.RESEND_API_KEY && c.env.MAIL_FROM),
    paymentWindowSeconds: Number(c.env.PAYMENT_WINDOW_SECONDS),
    quoteLockSeconds: Number(c.env.QUOTE_LOCK_SECONDS),
  });
});
app.post("/api/auth/guest", async (c) => {
  const uid = id();
  await run(c, "INSERT INTO users(id,created_at) VALUES(?,?)", uid, now());
  return c.json(
    {
      userId: uid,
      token: await session(c, uid),
      warning: "请保管本机凭证；未绑定邮箱且凭证丢失时无法自助恢复。",
    },
    201,
  );
});
app.post("/api/auth/exchange", async (c) => {
  const b = await body(c, z.object({ token: z.string().length(64) }).strict());
  const link = await one(
    c,
    "UPDATE login_links SET used=1 WHERE hash=? AND used=0 AND expires_at>? RETURNING user_id",
    await hash(b.token),
    now(),
  );
  if (!link) fail(401, "登录链接已使用或过期");
  const t = await session(c, link.user_id, "web");
  setCookie(c, "mc4need", t, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: 604800,
  });
  return c.json({ ok: true });
});
app.post("/api/auth/recover", async (c) => {
  const b = await body(c, z.object({ email: z.email().max(254) }).strict());
  if (!c.env.RESEND_API_KEY) fail(503, "邮件服务尚未启用");
  const email = b.email.toLowerCase();
  await emailRate(c, email);
  const u = await one(c, "SELECT id FROM users WHERE email=?", email);
  if (u) {
    const t = token();
    await run(
      c,
      "INSERT INTO email_tokens(hash,user_id,email,purpose,expires_at) VALUES(?,?,?,?,?)",
      await hash(t),
      u.id,
      email,
      "recover",
      now() + 900000,
    );
    await sendMail(
      c.env,
      email,
      "Mc4Need · 恢复访问",
      `15 分钟内打开以下链接恢复访问。请勿转发。\n${c.env.PUBLIC_ORIGIN}/verify#${t}`,
    );
  }
  return c.json({
    ok: true,
    message: "如果该邮箱已绑定，我们已发送恢复链接。",
  });
});
app.post("/api/auth/verify", async (c) => {
  const b = await body(c, z.object({ token: z.string().length(64) }).strict());
  const e = await one(
    c,
    "SELECT * FROM email_tokens WHERE hash=? AND used=0 AND expires_at>?",
    await hash(b.token),
    now(),
  );
  if (!e) fail(401, "链接已使用或过期");
  const consumed = await one(
    c,
    "UPDATE email_tokens SET used=1 WHERE hash=? AND used=0 RETURNING user_id",
    await hash(b.token),
  );
  if (!consumed) fail(401, "链接已使用");
  if (e.purpose === "bind") {
    await run(
      c,
      "UPDATE users SET email=?,email_notifications=1 WHERE id=?",
      e.email,
      e.user_id,
    );
  }
  const t = await session(c, e.user_id, "web");
  setCookie(c, "mc4need", t, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: 604800,
  });
  return c.json({ ok: true });
});
app.get("/api/needs", async (c) => {
  await cleanup(c.env);
  const rows = await all(
    c,
    "SELECT * FROM needs WHERE hidden=0 AND status!='draft' ORDER BY demo ASC,created_at DESC LIMIT 100",
  );
  const items = await Promise.all(
    rows.map(async (n: any) =>
      publicNeed(
        n,
        await one(
          c,
          "SELECT * FROM attempts WHERE need_id=? AND active=1",
          n.id,
        ),
      ),
    ),
  );
  const stats = await one(
    c,
    "SELECT COUNT(*) AS completed,COALESCE(SUM(json_extract(data,'$.quantity')),0) AS meals FROM needs WHERE demo=0 AND hidden=0 AND status='completed'",
  );
  return c.json({ items, stats });
});
app.get("/api/needs/:id", async (c) => {
  const n = await need(c, c.req.param("id"));
  if (n.hidden || n.status === "draft") fail(404, "该需求暂未公开");
  return c.json(
    publicNeed(
      n,
      await one(c, "SELECT * FROM attempts WHERE need_id=? AND active=1", n.id),
    ),
  );
});
app.get("/api/needs/:id/cover", async (c) => {
  const n = await need(c, c.req.param("id"));
  if (n.hidden || n.status === "draft") fail(404, "该需求暂未公开");
  const cover = await one(
    c,
    "SELECT data FROM need_covers WHERE need_id=?",
    n.id,
  );
  if (!cover) fail(404, "未找到配图");
  c.header("Content-Type", "image/webp");
  return c.body(new Uint8Array(cover.data));
});
app.post("/api/needs/:id/report", async (c) => {
  const n = await need(c, c.req.param("id"));
  if (n.hidden || n.status === "draft") fail(404, "未找到需求");
  const b = await body(
    c,
    z.object({ reason: z.string().trim().min(5).max(1000) }).strict(),
  );
  await run(
    c,
    "INSERT INTO reports(id,need_id,reason,created_at) VALUES(?,?,?,?)",
    id(),
    n.id,
    b.reason,
    now(),
  );
  return c.json({ ok: true }, 201);
});
// Every route below requires a platform credential, never a McDonald's token.
app.use("/api/*", async (c, next) => {
  const t =
    c.req.header("Authorization")?.replace(/^Bearer /, "") ??
    getCookie(c, "mc4need");
  if (!t || t.length !== 64) fail(401, "请从 AI 获取一次性网页登录链接");
  const u = await one(
    c,
    "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>?",
    await hash(t!),
    now(),
  );
  if (!u) fail(401, "会话已过期，请从 AI 重新登录");
  c.set("user", u);
  await next();
});
app.get("/api/me", async (c) =>
  c.json({
    user: c.get("user"),
    needs: (
      await all(
        c,
        "SELECT * FROM needs WHERE owner_id=? ORDER BY created_at DESC",
        c.get("user").id,
      )
    ).map((n: any) => publicNeed(n)),
    attempts: await all(
      c,
      "SELECT a.*,n.data,n.status AS need_status FROM attempts a JOIN needs n ON n.id=a.need_id WHERE a.sponsor_id=? OR n.owner_id=? ORDER BY a.created_at DESC",
      c.get("user").id,
      c.get("user").id,
    ),
    notifications: await all(
      c,
      "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
      c.get("user").id,
    ),
  }),
);
app.get("/api/auth/identity", (c) => c.json({ user: c.get("user") }));
app.post("/api/auth/cli-session", async (c) => {
  await body(c, z.object({ confirmed: z.literal(true) }).strict());
  const uid = c.get("user").id;
  const access = await session(c, uid, "cli");
  await audit(c, "auth.cli-session", uid);
  return c.json({
    userId: uid,
    token: access,
    origin: c.env.PUBLIC_ORIGIN,
    createdAt: now(),
  });
});
app.post("/api/auth/link", async (c) => {
  const t = token();
  await run(
    c,
    "INSERT INTO login_links(hash,user_id,expires_at) VALUES(?,?,?)",
    await hash(t),
    c.get("user").id,
    now() + 300000,
  );
  return c.json({ url: `${c.env.PUBLIC_ORIGIN}/login#${t}`, expiresIn: 300 });
});
app.post("/api/auth/logout", async (c) => {
  const t =
    c.req.header("Authorization")?.replace(/^Bearer /, "") ??
    getCookie(c, "mc4need");
  await run(c, "DELETE FROM sessions WHERE hash=?", await hash(t!));
  deleteCookie(c, "mc4need", { path: "/" });
  return c.json({ ok: true });
});
app.post("/api/auth/revoke", async (c) => {
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(
      c.get("user").id,
    ),
    c.env.DB.prepare("DELETE FROM email_tokens WHERE user_id=?").bind(
      c.get("user").id,
    ),
    c.env.DB.prepare("DELETE FROM login_links WHERE user_id=?").bind(
      c.get("user").id,
    ),
  ]);
  deleteCookie(c, "mc4need", { path: "/" });
  return c.json({ ok: true });
});
app.post("/api/auth/email", async (c) => {
  const b = await body(c, z.object({ email: z.email().max(254) }).strict());
  const email = b.email.toLowerCase();
  await emailRate(c, email);
  if (await one(c, "SELECT id FROM users WHERE email=?", email))
    fail(409, "该邮箱已绑定；请使用账号恢复入口");
  const t = token();
  await sendMail(
    c.env,
    email,
    "Mc4Need · 验证邮箱",
    `验证后可恢复账号并接收邮件，随时可关闭邮件通知。15 分钟内打开：\n${c.env.PUBLIC_ORIGIN}/verify#${t}`,
  );
  await run(
    c,
    "INSERT INTO email_tokens(hash,user_id,email,purpose,expires_at) VALUES(?,?,?,?,?)",
    await hash(t),
    c.get("user").id,
    email,
    "bind",
    now() + 900000,
  );
  return c.json({ ok: true });
});
app.post("/api/preferences", async (c) => {
  const b = await body(
    c,
    z.object({ emailNotifications: z.boolean() }).strict(),
  );
  await run(
    c,
    "UPDATE users SET email_notifications=? WHERE id=?",
    b.emailNotifications ? 1 : 0,
    c.get("user").id,
  );
  return c.json({ ok: true });
});
app.post("/api/notifications/read", async (c) => {
  await run(
    c,
    "UPDATE notifications SET seen=1 WHERE user_id=?",
    c.get("user").id,
  );
  return c.json({ ok: true });
});
app.post("/api/needs", async (c) => {
  const b = await body(c, needSchema);
  const count = await one(
    c,
    "SELECT COUNT(*) AS n FROM needs WHERE owner_id=? AND status IN ('draft','open','update')",
    c.get("user").id,
  );
  if (count.n >= 10) fail(429, "最多同时管理 10 个未完成需求");
  const nid = id();
  const { privateDelivery, ...pub } = b;
  const data = {
    ...pub,
    quantity: b.meals.reduce((s: any, m: any) => s + m.quantity, 0),
  };
  await run(
    c,
    "INSERT INTO needs(id,owner_id,data,private_data,created_at,updated_at,accept_by,recurring_days) VALUES(?,?,?,?,?,?,?,?)",
    nid,
    c.get("user").id,
    JSON.stringify(data),
    await seal(privateDelivery, c.env.APP_SECRET),
    now(),
    now(),
    b.acceptBy,
    b.recurringDays,
  );
  await audit(c, "need.create", nid);
  return c.json({ id: nid, status: "draft", version: 1 }, 201);
});
app.get("/api/private/needs/:id", async (c) => {
  const n = await owner(c, c.req.param("id"));
  return c.json({
    ...publicNeed(n),
    privateDelivery: await unseal(n.private_data, c.env.APP_SECRET),
  });
});
app.get("/api/private/needs/:id/cover", async (c) => {
  const n = await owner(c, c.req.param("id"));
  const cover = await one(
    c,
    "SELECT data FROM need_covers WHERE need_id=?",
    n.id,
  );
  if (!cover) fail(404, "未找到配图");
  c.header("Content-Type", "image/webp");
  return c.body(new Uint8Array(cover.data));
});
app.put("/api/needs/:id/cover", async (c) => {
  const n = await owner(c, c.req.param("id"));
  if (n.demo) fail(409, "演示配图由平台管理");
  if (c.req.header("X-Public-Image-Consent") !== "true")
    fail(400, "请确认有权公开这张配图");
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (c.req.header("Content-Type") !== "image/webp" || !validCover(bytes))
    fail(400, "请使用网页上传有效的静态图片");
  const rev = id();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO need_covers(need_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(need_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
    ).bind(n.id, bytes, now()),
    c.env.DB.prepare(
      "UPDATE needs SET cover_revision=?,updated_at=? WHERE id=?",
    ).bind(rev, now(), n.id),
  ]);
  await audit(c, "need.cover.upload", n.id);
  return c.json({ ok: true, coverUrl: `/api/needs/${n.id}/cover?v=${rev}` });
});
app.delete("/api/needs/:id/cover", async (c) => {
  const n = await owner(c, c.req.param("id"));
  if (n.demo) fail(409, "演示配图由平台管理");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM need_covers WHERE need_id=?").bind(n.id),
    c.env.DB.prepare(
      "UPDATE needs SET cover_revision=NULL,updated_at=? WHERE id=?",
    ).bind(now(), n.id),
  ]);
  await audit(c, "need.cover.remove", n.id);
  return c.json({ ok: true });
});
app.put("/api/needs/:id", async (c) => {
  const n = await owner(c, c.req.param("id"));
  const b = await body(c, needSchema);
  if (n.demo) fail(409, "演示案例不能转换成真实需求");
  if (n.status === "completed" || n.status === "closed")
    fail(409, "请创建新一期");
  const { privateDelivery, ...pub } = b;
  const result = await run(
    c,
    "UPDATE needs SET data=?,private_data=?,accept_by=?,recurring_days=?,version=version+1,status='draft',updated_at=? WHERE id=? AND version=? AND NOT EXISTS(SELECT 1 FROM attempts WHERE need_id=? AND active=1)",
    JSON.stringify({
      ...pub,
      quantity: b.meals.reduce((s: any, m: any) => s + m.quantity, 0),
    }),
    await seal(privateDelivery, c.env.APP_SECRET),
    b.acceptBy,
    b.recurringDays,
    now(),
    n.id,
    n.version,
    n.id,
  );
  if (!result.meta.changes) fail(409, "需求已被承担或发生变更");
  await audit(c, "need.update", n.id);
  return c.json({ id: n.id, version: n.version + 1, status: "draft" });
});
app.post("/api/needs/:id/publish", async (c) => {
  const n = await owner(c, c.req.param("id"));
  const b = await body(
    c,
    z
      .object({ version: z.number().int(), confirmed: z.literal(true) })
      .strict(),
  );
  const data = JSON.parse(n.data);
  if (n.demo || n.status !== "draft" || n.accept_by <= now())
    fail(409, "只能发布未过截止的真实草稿");
  if (
    data.deliveryCheckedAt < now() - 1800000 ||
    data.deliveryCheckedAt > now() + 60000
  )
    fail(409, "请先在本人 MCP 重新核实配送与菜单，再更新草稿");
  const r = await run(
    c,
    "UPDATE needs SET status='open',updated_at=? WHERE id=? AND version=? AND status='draft'",
    now(),
    n.id,
    b.version,
  );
  if (!r.meta.changes) fail(409, "版本已变化");
  await audit(c, "need.publish", n.id);
  return c.json({ id: n.id, url: `${c.env.PUBLIC_ORIGIN}/needs/${n.id}` });
});
app.post("/api/needs/:id/next", async (c) => {
  const n = await owner(c, c.req.param("id"));
  if (n.demo || !n.recurring_days) fail(409, "不是可生成下一期的真实重复需求");
  const b = await body(c, z.object({ confirmed: z.literal(true) }).strict());
  const nid = await makeNext(c.env, n);
  return c.json(
    {
      id: nid,
      status: "draft",
      message: "请重新核实菜单、配送与时间，再更新并确认发布。",
    },
    201,
  );
});
app.post("/api/needs/:id/close", async (c) => {
  const n = await owner(c, c.req.param("id"));
  await body(c, z.object({ confirmed: z.literal(true) }).strict());
  if (n.demo || n.status === "completed") fail(409, "此记录不能关闭");
  const r = await run(
    c,
    "UPDATE needs SET status='closed',updated_at=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM attempts WHERE need_id=? AND active=1)",
    now(),
    n.id,
    n.id,
  );
  if (!r.meta.changes)
    fail(409, "已有赞助记录，请从订单提出取消申请并联系赞助人");
  await audit(c, "need.close", n.id);
  return c.json({ ok: true });
});
app.post("/api/needs/:id/claim", async (c) => {
  await cleanup(c.env);
  const n = await need(c, c.req.param("id"));
  const b = await body(
    c,
    z
      .object({
        version: z.number().int(),
        displayName: z.string().trim().min(1).max(60),
        contact: z.string().max(160).optional(),
      })
      .strict(),
  );
  if (n.demo || n.hidden || n.status !== "open" || n.accept_by <= now())
    fail(409, "该需求当前不可赞助");
  if (n.owner_id === c.get("user").id) fail(409, "不能赞助自己发布的需求");
  const count = await one(
    c,
    "SELECT COUNT(*) AS n FROM attempts WHERE sponsor_id=? AND active=1 AND state IN ('quoting','creating','uncertain','pending','late')",
    c.get("user").id,
  );
  if (count.n >= 3) fail(429, "请先处理当前未完成的赞助");
  const aid = id();
  const r = await run(
    c,
    "INSERT INTO attempts(id,need_id,sponsor_id,need_version,state,display_name,contact,created_at,updated_at,lock_until) SELECT ?,id,?,version,'quoting',?,?,?,?,? FROM needs WHERE id=? AND version=? AND status='open' AND hidden=0 AND accept_by>?",
    aid,
    c.get("user").id,
    b.displayName,
    b.contact ? await seal(b.contact, c.env.APP_SECRET) : null,
    now(),
    now(),
    now() + Number(c.env.QUOTE_LOCK_SECONDS) * 1000,
    n.id,
    b.version,
    now(),
  );
  if (!r.meta.changes) fail(409, "需求版本已变化");
  await notify(c, n.owner_id, n.id, "一位赞助人正在核实整单餐食。");
  return c.json(
    {
      id: aid,
      state: "quoting",
      revision: 1,
      privateDelivery: await unseal(n.private_data, c.env.APP_SECRET),
      need: publicNeed(n),
    },
    201,
  );
});
app.get("/api/attempts/:id", async (c) => {
  const { a, n } = await member(c, c.req.param("id"));
  return c.json({
    ...a,
    contact: a.contact ? await unseal(a.contact, c.env.APP_SECRET) : null,
    privateDelivery:
      a.active && a.need_version === n.version
        ? await unseal(n.private_data, c.env.APP_SECRET)
        : null,
    need: publicNeed(n),
    isOwner: n.owner_id === c.get("user").id,
    messages: await all(
      c,
      "SELECT id,user_id,body,created_at FROM messages WHERE attempt_id=? ORDER BY created_at",
      a.id,
    ),
    observations: await all(
      c,
      "SELECT data,created_at FROM observations WHERE attempt_id=? ORDER BY created_at",
      a.id,
    ),
  });
});
app.post("/api/attempts/:id/quote", async (c) => {
  const { a, n } = await sponsor(c, c.req.param("id"));
  const b = await body(c, quoteSchema);
  if (
    b.checkedAt < now() - 300000 ||
    b.checkedAt > now() + 60000 ||
    b.needVersion !== n.version
  )
    fail(409, "报价或需求已过期");
  const r = await run(
    c,
    "UPDATE attempts SET quote=?,revision=revision+1,updated_at=? WHERE id=? AND state='quoting' AND active=1 AND lock_until>? AND revision=?",
    JSON.stringify(b),
    now(),
    a.id,
    now(),
    a.revision,
  );
  if (!r.meta.changes) fail(409, "锁已过期或记录已变化");
  return c.json({ revision: a.revision + 1, quote: b });
});
app.post("/api/attempts/:id/creating", async (c) => {
  const { a, n } = await sponsor(c, c.req.param("id"));
  if (a.cancel_requested_at)
    fail(409, "已有取消申请，请联系对方；不要创建新订单");
  const b = await body(
    c,
    z
      .object({ revision: z.number().int(), confirmed: z.literal(true) })
      .strict(),
  );
  if (
    !a.quote ||
    JSON.parse(a.quote).checkedAt < now() - 300000 ||
    n.hidden ||
    n.accept_by <= now()
  )
    fail(409, "请重新核实报价和接单截止");
  const r = await run(
    c,
    "UPDATE attempts SET state='creating',revision=revision+1,updated_at=? WHERE id=? AND state='quoting' AND active=1 AND lock_until>? AND revision=?",
    now(),
    a.id,
    now(),
    b.revision,
  );
  if (!r.meta.changes) fail(409, "不能重复创建，请先核实当前记录");
  return c.json({
    id: a.id,
    state: "creating",
    instruction:
      "仅在本次成功响应后调用一次 MCP create-order；响应不明不得重试创建。",
  });
});
app.post("/api/attempts/:id/sync", async (c) => {
  const { a, n } = await sponsor(c, c.req.param("id"));
  const b = await body(c, syncSchema);
  if (
    await one(
      c,
      "SELECT id FROM observations WHERE attempt_id=? AND key=?",
      a.id,
      b.key,
    )
  )
    return c.json({ ok: true, duplicate: true });
  if (!a.active || a.state === "quoting") fail(409, "当前记录不能同步订单");
  if (
    b.observedAt > now() + 60000 ||
    b.createdAt > now() + 60000 ||
    b.createdAt < a.created_at - 60000 ||
    b.observedAt < b.createdAt
  )
    fail(400, "订单时间不合理");
  if (a.last_sync && b.observedAt < a.last_sync)
    fail(409, "拒绝旧状态覆盖新同步");
  const orderKey = await hash(b.orderId);
  if (a.order_key && a.order_key !== orderKey)
    fail(409, "此记录已关联另一订单，禁止替换");
  if (a.order_created_at && a.order_created_at !== b.createdAt)
    fail(409, "订单创建时间不可变更");
  const priorPaid =
    paidStates.includes(a.official_state) ||
    !!(await one(
      c,
      "SELECT id FROM observations WHERE attempt_id=? AND json_extract(data,'$.status') IN ('paid','preparing','delivering','delivered') LIMIT 1",
      a.id,
    ));
  const mapped = classifySync(b.status, b.createdAt, n.accept_by, priorPaid);
  const regression = priorPaid && ["pending", "expired"].includes(b.status);
  const late = b.createdAt > n.accept_by;
  const deadline = Math.min(
    a.pay_by ?? Infinity,
    payDeadline(
      b.createdAt,
      b.officialExpiry,
      Number(c.env.PAYMENT_WINDOW_SECONDS),
    ),
  );
  const paymentOverdue = b.status === "pending" && deadline < now();
  const issue = paymentOverdue
    ? "付款时限已过，请核实官方订单，当前仍保留占用"
    : regression
      ? "同步与此前付款记录冲突，请核实"
      : late
        ? "创建时间晚于最晚接单时间，请联系双方核实并申请取消"
        : b.status === "unknown"
          ? "订单结果不明，请核实，勿重复创建"
          : null;
  const state = regression || paymentOverdue ? "uncertain" : mapped.state;
  const release =
    mapped.release &&
    !regression &&
    b.unpaidConfirmed === true &&
    !n.received_at;
  const mutation = id();
  const result = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE attempts SET state=?,active=?,revision=revision+1,order_key=?,order_created_at=?,official_expiry=?,pay_by=?,official_state=?,last_sync=?,updated_at=?,cancel_result=COALESCE(?,cancel_result),refund_state=COALESCE(?,refund_state),issue=?,last_mutation=? WHERE id=? AND revision=? RETURNING revision",
    ).bind(
      state,
      release ? 0 : 1,
      orderKey,
      b.createdAt,
      b.officialExpiry,
      deadline,
      b.status,
      b.observedAt,
      now(),
      b.cancelResult ?? null,
      b.refundState ?? null,
      issue,
      mutation,
      a.id,
      a.revision,
    ),
    c.env.DB.prepare(
      "INSERT INTO observations(attempt_id,key,data,created_at) SELECT ?,?,?,? WHERE (SELECT last_mutation FROM attempts WHERE id=?)=?",
    ).bind(
      a.id,
      b.key,
      JSON.stringify({ ...b, orderId: undefined, source: "赞助人客户端同步" }),
      now(),
      a.id,
      mutation,
    ),
  ]);
  if (!result[0].results.length) fail(409, "同步冲突，请刷新");
  if (["cancelled", "expired"].includes(b.status) && !release)
    await run(
      c,
      "UPDATE needs SET status='closed',issue='订单已结束，退款情况见赞助记录',updated_at=? WHERE id=? AND status!='completed'",
      now(),
      n.id,
    );
  await notify(
    c,
    n.owner_id,
    n.id,
    `订单状态更新：${state}（赞助人客户端同步）`,
  );
  await cleanup(c.env);
  return c.json({
    ok: true,
    state,
    release,
    payBy: deadline,
    issue,
  });
});
app.post("/api/attempts/:id/uncertain", async (c) => {
  const { a } = await sponsor(c, c.req.param("id"));
  if (!a.active || a.state !== "creating")
    fail(409, "当前阶段不可标记创建不明");
  await run(
    c,
    "UPDATE attempts SET state='uncertain',issue='创建结果不明，须查询本人官方订单，不可重复下单',revision=revision+1,updated_at=? WHERE id=? AND revision=?",
    now(),
    a.id,
    a.revision,
  );
  return c.json({ ok: true });
});
app.post("/api/attempts/:id/release", async (c) => {
  const { a } = await sponsor(c, c.req.param("id"));
  const r = await run(
    c,
    "UPDATE attempts SET active=0,state='released',revision=revision+1,updated_at=? WHERE id=? AND state='quoting' AND active=1",
    now(),
    a.id,
  );
  if (!r.meta.changes)
    fail(409, "已进入创建阶段，需查询并同步官方取消或失效结果");
  await cleanup(c.env);
  return c.json({ ok: true });
});
app.post("/api/attempts/:id/unavailable", async (c) => {
  const { a, n } = await sponsor(c, c.req.param("id"));
  const b = await body(
    c,
    z.object({ reason: z.string().trim().min(1).max(500) }).strict(),
  );
  if (a.state !== "quoting" || !a.active) fail(409, "下单后不能走缺货释放路径");
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE needs SET status='update',issue=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM attempts WHERE id=? AND state='quoting' AND active=1)",
    ).bind(b.reason, now(), n.id, a.id),
    c.env.DB.prepare(
      "UPDATE attempts SET active=0,state='released',revision=revision+1,updated_at=? WHERE id=? AND state='quoting' AND active=1",
    ).bind(now(), a.id),
  ]);
  await notify(
    c,
    n.owner_id,
    n.id,
    "指定餐食或配送不可用，请更新需求后重新发布。",
  );
  return c.json({ ok: true });
});
app.post("/api/attempts/:id/cancel", async (c) => {
  const { a, n } = await member(c, c.req.param("id"));
  if (!a.active || ["cancelled", "expired", "released"].includes(a.state))
    fail(409, "订单已结束");
  const b = await body(
    c,
    z.object({ reason: z.string().trim().min(1).max(1000) }).strict(),
  );
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE attempts SET cancel_requested_at=COALESCE(cancel_requested_at,?),revision=revision+1,updated_at=? WHERE id=?",
    ).bind(now(), now(), a.id),
    c.env.DB.prepare(
      "INSERT INTO messages(id,attempt_id,user_id,body,created_at) VALUES(?,?,?,?,?)",
    ).bind(id(), a.id, c.get("user").id, `取消申请：${b.reason}`, now()),
  ]);
  await notify(
    c,
    a.sponsor_id === c.get("user").id ? n.owner_id : a.sponsor_id,
    n.id,
    "收到取消申请，请打开订单留言联系对方。只有赞助人能取消自己的麦当劳订单。",
  );
  return c.json({
    ok: true,
    contactPath: `/orders/${a.id}`,
    message: "申请已提交；不代表取消成功或退款到账。",
  });
});
app.post("/api/attempts/:id/messages", async (c) => {
  const { a, n } = await member(c, c.req.param("id"));
  const b = await body(
    c,
    z.object({ body: z.string().trim().min(1).max(2000) }).strict(),
  );
  await run(
    c,
    "INSERT INTO messages(id,attempt_id,user_id,body,created_at) VALUES(?,?,?,?,?)",
    id(),
    a.id,
    c.get("user").id,
    b.body,
    now(),
  );
  await notify(
    c,
    a.sponsor_id === c.get("user").id ? n.owner_id : a.sponsor_id,
    n.id,
    "你有一条新的订单留言。",
  );
  return c.json({ ok: true }, 201);
});
app.post("/api/needs/:id/receipt", async (c) => {
  const n = await owner(c, c.req.param("id"));
  const b = await body(
    c,
    z
      .object({
        received: z.boolean(),
        feedback: z.string().trim().max(2000).optional(),
        issue: z.string().trim().max(1000).optional(),
        publicConsent: z.boolean(),
      })
      .strict(),
  );
  const a = await one(
    c,
    "SELECT * FROM attempts WHERE need_id=? AND active=1",
    n.id,
  );
  if (n.demo || !a || !a.order_key) fail(409, "尚无已关联订单");
  if (n.status === "completed") {
    if (b.issue) {
      await run(
        c,
        "UPDATE needs SET issue=?,updated_at=? WHERE id=?",
        b.issue,
        now(),
        n.id,
      );
      await audit(c, "receipt.issue", n.id);
      return c.json({ ok: true, status: "completed", issue: b.issue });
    }
    return c.json({ ok: true, status: "completed", duplicate: true });
  }
  if (!b.received || b.issue) {
    await run(
      c,
      "UPDATE needs SET issue=?,updated_at=? WHERE id=?",
      b.issue || "发起方报告未收到餐食",
      now(),
      n.id,
    );
    await notify(c, a.sponsor_id, n.id, "发起方报告收餐异常，请打开订单查看。");
    return c.json({ ok: true, status: n.status, issue: b.issue || "未收到" });
  }
  const complete = !!b.feedback && b.publicConsent;
  if (b.feedback && !b.publicConsent) fail(400, "公开反馈前需要确认允许展示");
  const receiptResult = await run(
    c,
    "UPDATE needs SET received_at=COALESCE(received_at,?),feedback=COALESCE(?,feedback),completed_at=CASE WHEN ? THEN COALESCE(completed_at,?) ELSE completed_at END,status=CASE WHEN ? THEN 'completed' ELSE status END,updated_at=? WHERE id=? AND status!='completed'",
    now(),
    b.feedback || null,
    complete ? 1 : 0,
    now(),
    complete ? 1 : 0,
    now(),
    n.id,
  );
  if (!receiptResult.meta.changes)
    return c.json({ ok: true, status: "completed", duplicate: true });
  await notify(
    c,
    a.sponsor_id,
    n.id,
    complete
      ? "发起方已确认收餐并提交反馈。感谢你的支持！"
      : "发起方已确认收餐，等待反馈。",
  );
  await audit(c, complete ? "receipt.complete" : "receipt.received", n.id);
  return c.json({
    ok: true,
    status: complete ? "completed" : "awaiting_feedback",
  });
});
app.use("/api/admin/*", async (c, next) => {
  if (!c.get("user").admin) fail(403, "需要管理员权限");
  await next();
});
app.get("/api/admin/overview", async (c) =>
  c.json({
    reports: await all(
      c,
      "SELECT * FROM reports ORDER BY created_at DESC LIMIT 100",
    ),
    needs: await all(
      c,
      "SELECT id,status,hidden,demo,data,issue FROM needs ORDER BY updated_at DESC LIMIT 100",
    ),
    audit: await all(
      c,
      "SELECT action,target,created_at FROM audit ORDER BY id DESC LIMIT 100",
    ),
    exceptions: await all(
      c,
      "SELECT id,need_id,state,issue,updated_at FROM attempts WHERE active=1 AND (state IN ('uncertain','late','creating') OR (state='pending' AND pay_by<?))",
      now(),
    ),
  }),
);
app.post("/api/admin/needs/:id", async (c) => {
  const b = await body(
    c,
    z
      .object({
        hidden: z.boolean(),
        reason: z.string().trim().min(1).max(500),
      })
      .strict(),
  );
  await run(
    c,
    "UPDATE needs SET hidden=?,issue=?,updated_at=? WHERE id=?",
    b.hidden ? 1 : 0,
    b.reason,
    now(),
    c.req.param("id"),
  );
  await audit(c, b.hidden ? "admin.hide" : "admin.restore", c.req.param("id"));
  return c.json({ ok: true });
});
app.post("/api/admin/reports/:id/resolve", async (c) => {
  await run(c, "UPDATE reports SET resolved=1 WHERE id=?", c.req.param("id"));
  await audit(c, "report.resolve", c.req.param("id"));
  return c.json({ ok: true });
});
app.all("/api/*", (c) => c.json({ error: "未找到接口" }, 404));
export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, ctx);
    const response = await env.ASSETS.fetch(request);
    if (url.pathname.startsWith("/needs/")) {
      const nid = url.pathname.split("/")[2];
      const n = await env.DB.prepare(
        "SELECT * FROM needs WHERE id=? AND hidden=0 AND status!='draft'",
      )
        .bind(nid)
        .first<any>();
      if (n) {
        const d = JSON.parse(n.data);
        const title = `${n.demo ? "演示案例 · 模拟完成｜" : ""}${d.title} — Mc4Need`;
        const desc = n.demo
          ? "虚构场景演示，不代表真实履约、机构合作或可下单需求。"
          : `${d.quantity} 份餐食 · ${d.location.name} · Sponsor a meal. Be part of it.`;
        return new HTMLRewriter()
          .on("title", {
            element(e) {
              e.setInnerContent(title);
            },
          })
          .on('meta[property="og:title"]', {
            element(e) {
              e.setAttribute("content", title);
            },
          })
          .on('meta[property="og:description"],meta[name="description"]', {
            element(e) {
              e.setAttribute("content", desc);
            },
          })
          .transform(response);
      }
      return new Response(response.body, {
        status: 404,
        headers: response.headers,
      });
    }
    return response;
  },
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) =>
    ctx.waitUntil(scheduledMaintenance(env)),
};
