import { t, locale, setLocale, localizeNeed } from "./i18n";
import { Cover, CoverEditor } from "./covers";
import { makePrompt, type PromptKind } from "./prompts";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Copy,
  Check,
  ChevronLeft,
  Clock,
  Heart,
  Menu,
  X,
  MessageCircle,
  CheckCircle2,
  Utensils,
  Terminal,
  CalendarDays,
  ShieldCheck,
  ExternalLink,
  GitFork,
} from "lucide-react";
import "./style.css";
type Need = {
  id: string;
  title: string;
  story: string;
  organizer: string;
  scene: string;
  coverUrl?: string | null;
  coverRevision?: string | null;
  meals: { name: string; quantity: number; specification: string }[];
  quantity: number;
  location: { name: string; address: string; lat: number; lng: number };
  mealAt: number;
  acceptBy: number;
  referenceCents: number | null;
  referenceAt: number | null;
  recurringDays: number | null;
  demo: boolean;
  status: string;
  version: number;
  receivedAt: number | null;
  feedback: string | null;
  completedAt: number | null;
  issue: string | null;
  progress: any;
};
const SITE = "https://mc4need.david-widgets.com";
const REPO = "https://github.com/drdavid-kor/mc4need";
const date = (v: number) =>
  new Date(v).toLocaleString(locale === "en" ? "en-GB" : "zh-CN", {
    timeZone: "Asia/Shanghai",
    timeZoneName: "short",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const money = (c: number) =>
  `${locale === "en" ? "CNY " : "¥"}${(c / 100).toFixed(2)}`;
const statusName: Record<string, string> = {
  draft: t("待确认草稿"),
  open: t("等待支持"),
  update: t("等待更新"),
  closed: t("已关闭"),
  completed: t("已完成"),
  quoting: t("核实餐食中"),
  creating: t("正在创建订单"),
  uncertain: t("等待核实"),
  pending: t("等待付款"),
  paid: t("已付款"),
  preparing: t("准备餐食中"),
  delivering: t("配送中"),
  delivered: t("等待收餐反馈"),
  cancelled: t("已取消"),
  expired: t("已失效"),
  late: t("超时创建 · 待核实"),
  released: t("已释放"),
};
function visibleProgress(n: Need) {
  if (n.status === "completed") return t("已完成 · 发起方已确认收餐与反馈");
  if (n.receivedAt) return t("已收餐 · 等待发起方反馈");
  return n.progress ? statusName[n.progress.state] : statusName[n.status];
}
async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const value: any = await res.json();
  if (!res.ok) throw new Error(t(value.error || t("请求失败")));
  return value;
}
function post(path: string, value: unknown = {}) {
  return api(path, { method: "POST", body: JSON.stringify(value) });
}
function IconMark() {
  return (
    <span className="brand-mark">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M8 28V13l8 10 4-6 4 6 8-10v15" />
      </svg>
    </span>
  );
}
function App() {
  const [path, setPath] = useState(location.pathname);
  const [modal, setModal] = useState<PromptKind | null>(null);
  const [menu, setMenu] = useState(false);
  const [autoCopied, setAutoCopied] = useState(false);
  async function openPrompt(value: PromptKind) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(makePrompt(value, locale === "en"));
      copied = true;
    } catch {}
    setAutoCopied(copied);
    setModal(value);
    setMenu(false);
  }
  useEffect(() => {
    const f = () => {
      setPath(location.pathname);
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, []);
  function go(e: React.MouseEvent<HTMLAnchorElement>, url: string) {
    if (!e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      history.pushState({}, "", url);
      setPath(url);
      setMenu(false);
      window.scrollTo(0, 0);
    }
  }
  const link = (url: string, label: React.ReactNode, cls = "") => (
    <a className={cls} href={url} onClick={(e) => go(e, url)}>
      {label}
    </a>
  );
  return (
    <>
      <header className="header">
        <div className="nav-wrap">
          {link(
            "/",
            <>
              <IconMark />
              <span>
                Mc4Need<span className="brand-dot">.</span>
              </span>
            </>,
            "brand",
          )}
          <button
            className="menu-toggle ghost"
            aria-label={t("打开导航")}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <button
            className="language-toggle text-button"
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            aria-label="Switch language / 切换语言"
          >
            {locale === "en" ? t("中文") : "English"}
          </button>
          <nav className={menu ? "nav open" : "nav"}>
            {link("/", t("探索需求 / Explore"))}
            {link("/guide", t("如何参与 / How it works"))}
            {link("/dashboard", t("我的记录 / My space"))}
            <a href={REPO} target="_blank" rel="noreferrer" className="github">
              <GitFork size={15} />
              GitHub
              <ArrowUpRight size={14} />
            </a>
            <button
              className="button small dark"
              onClick={() => void openPrompt("publish")}
            >
              {t("发起需求 ")}
              <span>Start a need</span>
              <ArrowUpRight size={16} />
            </button>
          </nav>
        </div>
      </header>
      <main>
        {path === "/" ? (
          <Home link={link} open={openPrompt} />
        ) : path.startsWith("/needs/") ? (
          <Detail id={path.split("/")[2]} link={link} open={openPrompt} />
        ) : path === "/guide" ? (
          <Guide open={openPrompt} />
        ) : path === "/privacy" ? (
          <Privacy />
        ) : path === "/login" || path === "/verify" ? (
          <Login verify={path === "/verify"} link={link} />
        ) : path === "/dashboard" ? (
          <Dashboard link={link} open={openPrompt} />
        ) : path.startsWith("/orders/") ? (
          <Order id={path.split("/")[2]} link={link} />
        ) : path === "/admin" ? (
          <Admin />
        ) : (
          <section className="page narrow">
            <h1>{t("这页走丢了。")}</h1>
            {link("/", t("回到首页"), "button dark")}
          </section>
        )}
      </main>
      <footer>
        <div className="footer-top">
          <div>
            <div className="brand">
              <IconMark />
              Mc4Need.
            </div>
            <p>
              Sponsor a meal. Be part of it.
              <br />
              {t("一餐，让我们有了交集。")}
            </p>
          </div>
          <div>
            {link("/guide", t("参与方式"))}
            {link("/privacy", t("隐私与使用说明"))}
            <a href={REPO} target="_blank" rel="noreferrer">
              {t("开源代码 ↗")}
            </a>
          </div>
          <div className="footer-note">
            {t("独立开发者项目 · 麦当劳 MCP 创新挑战赛作品")}
            <br />
            {t("非麦当劳官方平台。演示案例不代表真实合作。")}
            <br />
            <span>Made for a little more togetherness.</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Mc4Need</span>
          <span>One meal. A shared story.</span>
        </div>
      </footer>
      {modal && (
        <PromptModal
          value={modal}
          initiallyCopied={autoCopied}
          close={() => setModal(null)}
        />
      )}
    </>
  );
}
function Badge({ n }: { n: Need }) {
  return (
    <span className={`badge ${n.demo ? "demo" : "live"}`}>
      <i />
      {n.demo ? t("演示案例 · 模拟完成") : statusName[n.status] || n.status}
    </span>
  );
}
function Home({ link, open }: any) {
  const [data, setData] = useState<{ items: Need[]; stats: any } | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  useEffect(() => {
    api("/needs")
      .then((v) =>
        setData(v.items ? { ...v, items: v.items.map(localizeNeed) } : v),
      )
      .catch((e) => setError(e.message));
  }, []);
  const items = data?.items.filter(
    (n) => filter === "all" || (filter === "demo" ? n.demo : !n.demo),
  );
  return (
    <>
      <section className="hero page">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-line" /> A SEAT AT SOMEONE’S TABLE
          </div>
          <h1>
            Sponsor a meal.
            <br />
            <em>Be part of it.</em>
          </h1>
          <h2>{t("请一顿饭，参与一个故事。")}</h2>
          <p>
            {t("也许是孩子们的集体生日，也许是终场哨后的相聚。")}
            <br className="desktop" />
            {t("发起方定好餐食，你支持完整的一餐。")}
            <br className="desktop" />
            {t("从一份明确的需要，到一句收到后的谢谢。")}
          </p>
          <div className="hero-actions">
            <button className="button dark" onClick={() => open("watch")}>
              {t("关注餐食需求 ")}
              <Copy size={18} />
            </button>
            <button className="text-button" onClick={() => open("publish")}>
              {t("我想发起需求 ")}
              <ArrowUpRight size={18} />
            </button>
          </div>
          <p className="service-region">
            {t("服务范围：中国大陆 · 人民币结算")}
          </p>
          <div className="hero-foot">
            <span>
              <span className="dot" />
              {t("一人赞助整单")}
            </span>
            <span>{t("在自己的 AI 中下单")}</span>
            <span>{t("收餐后看见反馈")}</span>
          </div>
        </div>
        <div className="hero-art">
          <div className="art-note note-top">
            Good food.
            <br />
            Better together.<span>{t("让每一餐，有人惦记。")}</span>
          </div>
          <div className="big-plate">
            <div className="plate-inner">
              <div className="burger">
                <div className="bun top">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="lettuce" />
                <div className="patty" />
                <div className="bun bottom" />
              </div>
              <div className="fries">
                <i />
                <i />
                <i />
                <i />
                <i />
                <b>for you</b>
              </div>
            </div>
          </div>
          <div className="art-sticker">
            <Heart size={22} />
            <span>
              ONE MEAL
              <br />
              MANY SMILES
            </span>
          </div>
          <div className="art-note note-bottom">
            <span className="scribble">↗</span>It starts with a meal.
          </div>
        </div>
      </section>
      <div className="principles">
        <span>
          {t("明确的餐食 ")}
          <small>A clear need</small>
        </span>
        <span>
          {t("完整的支持 ")}
          <small>A whole meal</small>
        </span>
        <span>
          {t("看得见的回应 ")}
          <small>A shared story</small>
        </span>
      </div>
      <section className="page discover" id="discover">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FIND YOUR CONNECTION</div>
            <h2>
              {t("从这一餐开始")}
              <span>Find a meal to be part of.</span>
            </h2>
          </div>
          <div className="filters" role="group" aria-label={t("案例筛选")}>
            {[
              ["all", t("全部")],
              ["live", t("真实需求")],
              ["demo", t("演示案例")],
            ].map(([v, l]) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => setFilter(v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="honesty-note">
          <span className="dot" />
          {t("真实完成 ")}
          <strong>{data?.stats.completed ?? "—"}</strong>
          {t(" 例 · 收到餐食")} <strong>{data?.stats.meals ?? "—"}</strong>
          {t(" 份")} <span className="note-divider">/</span>
          {t(" 演示数据不计入真实成果。")}
        </div>
        {error ? (
          <ErrorBox text={error} />
        ) : !data ? (
          <div className="loading">{t("正在把故事端上桌…")}</div>
        ) : items?.length ? (
          <div className="cards">
            {items.map((n) => (
              <article className="card" key={n.id}>
                {link(
                  `/needs/${n.id}`,
                  <Cover scene={n.scene} url={n.coverUrl} />,
                  "scene-link",
                )}
                <div className="card-body">
                  <Badge n={n} />
                  <h3>{link(`/needs/${n.id}`, n.title)}</h3>
                  <p>{n.story}</p>
                  <div className="card-location">
                    <MapPin size={14} />
                    {n.location.name}
                  </div>
                  <div className="card-bottom">
                    <span>
                      <strong>{n.quantity}</strong>
                      {t(" 份餐食")}{" "}
                      <small>
                        {n.recurringDays
                          ? t("逐期确认 · 重复需求")
                          : t("单次需求")}
                      </small>
                    </span>
                    {link(
                      `/needs/${n.id}`,
                      <ArrowUpRight size={24} />,
                      "arrow-circle",
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Utensils size={30} />
            <h3>{t("第一份真实的需要，正在路上。")}</h3>
            <p>
              {t(
                "你可以在 AI 中发起需求。公开发布无需邀请，也无需先绑定邮箱。",
              )}
            </p>
            <button className="button dark" onClick={() => open("publish")}>
              {t("发起第一份需求 ")}
              <ArrowUpRight size={17} />
            </button>
          </div>
        )}
      </section>
      <section className="how-section">
        <div className="page">
          <div className="section-heading">
            <div>
              <div className="eyebrow">SMALL GESTURE, REAL CONNECTION</div>
              <h2>
                {t("心意，走完这一程。")}
                <span>From a need to a thank-you.</span>
              </h2>
            </div>
            {link(
              "/guide",
              <>
                {t("了解完整流程 ")}
                <ArrowUpRight size={16} />
              </>,
              "text-button",
            )}
          </div>
          <div className="steps">
            {[
              [
                "01",
                t("提出一份需要"),
                "Make it specific",
                t("发起方在 AI 中确认餐食、份数、地点与用餐安排。"),
              ],
              [
                "02",
                t("支持完整的一餐"),
                "Sponsor the whole meal",
                t("复制专属指引到自己的 AI，核实整单总价，确认后下单付款。"),
              ],
              [
                "03",
                t("收到一份回应"),
                "See the story continue",
                t("发起方确认收到餐食并留下反馈，你的支持成为故事的一部分。"),
              ],
            ].map(([num, title, en, desc]) => (
              <div className="step" key={num}>
                <span>{num}</span>
                <h3>
                  {title}
                  <small>{en}</small>
                </h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="page final-cta">
        <div className="eyebrow">OPEN SOURCE. OPEN TABLE.</div>
        <h2>{t("给一个好故事，加一份餐。")}</h2>
        <p>
          {t(
            "正在建设的开源项目。欢迎使用、反馈，也欢迎在 GitHub 留下一颗 Star。",
          )}
        </p>
        <div>
          <button className="button dark" onClick={() => open("publish")}>
            {t("发起需求 ")}
            <ArrowUpRight size={18} />
          </button>
          <a
            className="button outline"
            href={REPO}
            target="_blank"
            rel="noreferrer"
          >
            {t("看看 GitHub ")}
            <GitFork size={17} />
          </a>
        </div>
      </section>
    </>
  );
}
function Detail({ id, link, open }: any) {
  const [n, setN] = useState<Need | null>(null);
  const [error, setError] = useState("");
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    setN(null);
    api(`/needs/${id}`)
      .then((v) => setN(localizeNeed(v)))
      .catch((e) => setError(e.message));
  }, [id]);
  if (error)
    return (
      <section className="page">
        <ErrorBox text={error} />
      </section>
    );
  if (!n) return <div className="page loading">{t("正在读取需求…")}</div>;
  return (
    <section className="page detail">
      {link(
        "/",
        <>
          <ChevronLeft size={16} />
          {t("返回探索")}
        </>,
        "back",
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <Badge n={n} />
          <h1>{n.title}</h1>
          <p className="detail-sub">
            {n.organizer} <span>·</span>{" "}
            {n.recurringDays
              ? t("每 {0} 天一份需要，逐期确认", [n.recurringDays])
              : t("一份单次的需要")}
          </p>
          <Cover scene={n.scene} url={n.coverUrl} large />
          {n.demo && (
            <div className="demo-notice">
              <ShieldCheck size={21} />
              <div>
                <strong>{t("这是一份虚构场景演示 · Simulated example")}</strong>
                <p>
                  {t(
                    "人物、餐食、署名与反馈均为模拟。不代表真实履约、机构合作或可下单需求。",
                  )}
                </p>
              </div>
            </div>
          )}
          <section className="detail-section">
            <div className="eyebrow">THE STORY</div>
            <h2>{t("为什么是这一餐")}</h2>
            <p className="story">{n.story}</p>
            {!n.demo && locale === "en" && (
              <p className="muted">
                Requester content is shown in its original language. Receiving
                addresses are never translated.
              </p>
            )}
          </section>
          <section className="detail-section">
            <div className="eyebrow">WHAT’S ON THE TABLE</div>
            <h2>{t("已经想好的餐食")}</h2>
            <div className="meals">
              {n.meals.map((m, i) => (
                <div key={i}>
                  <Utensils size={20} />
                  <span>
                    <strong>{m.name}</strong>
                    <small>{m.specification}</small>
                  </span>
                  <b>× {m.quantity}</b>
                </div>
              ))}
            </div>
            <p className="muted">
              {t(
                "由一位赞助人承担整单。餐食不可由赞助人自行替换；实际价格与配送安排须在本人账号重新核实。",
              )}
            </p>
          </section>
          <section className="detail-section">
            <div className="eyebrow">WHERE IT GOES</div>
            <h2>{t("这一餐的目的地")}</h2>
            <div className="location-title">
              <MapPin />
              <div>
                <strong>{n.location.name}</strong>
                <p>{n.location.address}</p>
              </div>
            </div>
            {n.demo ? (
              <div className="demo-map">
                <div className="map-grid" />
                <MapPin size={35} />
                <strong>{t("地点示意 · Illustrative location")}</strong>
                <p>{t("演示不对应真实收货点，也不代表配送范围。")}</p>
              </div>
            ) : (
              <>
                <iframe
                  title={t("公开收货地点地图")}
                  loading="lazy"
                  className="map"
                  referrerPolicy="no-referrer"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${n.location.lng - 0.015}%2C${n.location.lat - 0.008}%2C${n.location.lng + 0.015}%2C${n.location.lat + 0.008}&layer=mapnik&marker=${n.location.lat}%2C${n.location.lng}`}
                />
                <a
                  className="text-button"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.openstreetmap.org/?mlat=${n.location.lat}&mlon=${n.location.lng}#map=16/${n.location.lat}/${n.location.lng}`}
                >
                  {t("打开地图 ")}
                  <ExternalLink size={14} />
                </a>
                <p className="muted">
                  {t(
                    "公开定位不代表已核实可配送。联系人及配送补充信息仅订单双方可见。",
                  )}
                </p>
              </>
            )}
          </section>
          <section className="detail-section">
            <div className="eyebrow">THE RETURNING STORY</div>
            <h2>{t("这一餐，后来呢")}</h2>
            {n.feedback ? (
              <blockquote>
                <span>“</span>
                {n.feedback}
                <footer>
                  {n.demo ? t("模拟发起方反馈") : t("发起方收餐反馈")} ·{" "}
                  {date(n.completedAt!)}
                </footer>
              </blockquote>
            ) : (
              <p className="muted">
                {t("收到餐食并提交反馈后，故事会在这里继续。")}
              </p>
            )}
            <div className="timeline">
              <div>
                <i />
                <strong>{t("需求已发布")}</strong>
                <span>{n.demo ? t("模拟场景") : t("发起方发布")}</span>
              </div>
              {(n.demo || n.progress) && (
                <div>
                  <i />
                  <strong>
                    {n.demo
                      ? t("餐食已送达（模拟）")
                      : statusName[n.progress.state]}
                  </strong>
                  <span>
                    {n.demo
                      ? t("演示数据")
                      : `${t(n.progress.source)} · ${n.progress.lastSync ? date(n.progress.lastSync) : t("尚无订单同步")}`}
                  </span>
                </div>
              )}
              {n.receivedAt && (
                <div>
                  <i />
                  <strong>{t("发起方确认收到餐食")}</strong>
                  <span>{n.demo ? t("模拟确认") : date(n.receivedAt)}</span>
                </div>
              )}
              {n.completedAt && (
                <div>
                  <i />
                  <strong>{t("反馈已收到 · 完成")}</strong>
                  <span>
                    {n.demo
                      ? t("模拟完成，不计入真实成果")
                      : t("发起方确认并提交反馈")}
                  </span>
                </div>
              )}
            </div>
            {n.issue && <ErrorBox text={n.issue} />}
          </section>
          <button
            className="muted text-button"
            onClick={() => setReport(!report)}
          >
            {t("反馈这个页面的问题")}
          </button>
          {report && (
            <form
              className="form-box"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await post(`/needs/${n.id}/report`, { reason });
                  setMsg(t("已提交，感谢反馈。"));
                  setReport(false);
                } catch (e: any) {
                  setMsg(e.message);
                }
              }}
            >
              <label>
                {t("问题说明")}
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button className="button dark">{t("提交反馈")}</button>
            </form>
          )}
          {msg && <p role="status">{msg}</p>}
        </div>
        <aside className="support-panel">
          <div className="eyebrow">ONE SPONSOR, ONE WHOLE MEAL</div>
          <div className="quantity">
            <b>{n.quantity}</b>
            <span>
              {t("份餐食")}
              <br />
              <small>meals, together</small>
            </span>
          </div>
          <div className="panel-facts">
            <div>
              <CalendarDays size={18} />
              <span>
                {t("用餐安排")}
                <strong>{date(n.mealAt)}</strong>
              </span>
            </div>
            <div>
              <Clock size={18} />
              <span>
                {t("最晚接单")}
                <strong>{date(n.acceptBy)}</strong>
              </span>
            </div>
            {n.referenceCents !== null && (
              <div>
                <Utensils size={18} />
                <span>
                  {n.demo ? t("模拟参考价") : t("参考餐价")}
                  <strong>{money(n.referenceCents)}</strong>
                  <small>
                    {n.demo
                      ? t("仅用于演示")
                      : t("截至 {0}，实际含配送总价以重新算价为准", [
                          date(n.referenceAt!),
                        ])}
                  </small>
                </span>
              </div>
            )}
          </div>
          {n.demo ? (
            <>
              <div className="thanks">
                <Heart size={19} />
                <span>
                  {t("谢谢「")}
                  {n.progress?.name || t("一位热心的朋友")}
                  {locale === "en" ? "" : "」"}
                  <small>{t("演示署名 · Simulated sponsor")}</small>
                </span>
              </div>
              <button
                className="button dark wide"
                onClick={() => open("publish")}
              >
                {t("我也有一份需要 ")}
                <ArrowUpRight size={18} />
              </button>
              <p className="muted">{t("演示案例不开放赞助与付款。")}</p>
            </>
          ) : n.status === "open" && !n.progress ? (
            <>
              <button className="button dark wide" onClick={() => open(n)}>
                {t("支持这顿饭 ")}
                <ArrowUpRight size={18} />
              </button>
              <p className="muted">
                {t(
                  "复制指引到可执行 Skill 的 AI 客户端。核实整单金额并确认后，使用自己的麦当劳账号下单。",
                )}
              </p>
            </>
          ) : (
            <>
              <div className="status-block">{visibleProgress(n)}</div>
              {n.progress?.lastSync && (
                <p className="muted">
                  {t("赞助人客户端同步：")}
                  {statusName[n.progress.state]} · {date(n.progress.lastSync)}
                  <br />
                  {t("非实时物流或平台独立验真。")}
                </p>
              )}
            </>
          )}
          <div className="panel-note">
            <ShieldCheck size={16} />
            <span>
              {t("平台不收取你的麦当劳 Token。")}
              <br />
              {t("在官方入口自行付款。")}
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}
function PromptModal({
  value,
  initiallyCopied = false,
  close,
}: {
  value: PromptKind;
  initiallyCopied?: boolean;
  close: () => void;
}) {
  const [copied, setCopied] = useState(initiallyCopied);
  const [copyError, setCopyError] = useState(false);
  const publish = value === "publish";
  const watch = value === "watch";
  const text = makePrompt(value, locale === "en");
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".modal button, .modal textarea, .modal a",
          ),
        );
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", f);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", f);
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          autoFocus
          className="modal-close ghost"
          aria-label={t("关闭")}
          onClick={close}
        >
          <X />
        </button>
        <div className="eyebrow">TAKE IT TO YOUR AI</div>
        <h2 id="prompt-title">
          {watch
            ? t("让 AI 帮你关注合适的需要。")
            : publish
              ? t("让 AI 帮你发起需求。")
              : t("让 AI 帮你准备这一餐。")}
        </h2>
        <p>
          {watch
            ? t(
                "粘贴到你的 AI，设置关注范围与频率，有合适需求时提醒。关注本身不需要麦当劳登录。",
              )
            : t(
                "复制下面这段话，粘贴到能够安装 Skill、执行本地命令并连接麦当劳 MCP 的 AI 客户端。",
              )}
        </p>
        <div className="compat-note">
          <Terminal size={18} />
          <span>
            {t(
              "当前提供 Codex / Claude Code 安装路径。普通网页聊天窗口可能不具备执行能力；首次安装后可能需要重新加载 Skill。手机可浏览、复制与管理记录。",
            )}
          </span>
        </div>
        <textarea
          className="prompt-text"
          readOnly
          value={text}
          aria-label={t("可复制的 AI 指引")}
        />
        <button
          className="button dark wide"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setCopyError(false);
            } catch {
              const area =
                document.querySelector<HTMLTextAreaElement>(".prompt-text");
              area?.focus();
              area?.select();
              const copiedFallback = document.execCommand("copy");
              setCopied(copiedFallback);
              setCopyError(!copiedFallback);
            }
          }}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}{" "}
          {copied
            ? t("已复制，粘贴到你的 AI 即可")
            : t("复制完整指引 / Copy prompt")}
        </button>
        {copyError && (
          <p role="status" className="error">
            {t("浏览器未允许自动复制，指引已选中，请手动复制。")}
          </p>
        )}
        <p className="muted">
          {watch
            ? t(
                "需客户端支持持久化定时任务和通知。复制成功不代表任务已创建；不支持时 AI 应明确说明。关注不会认领、下单或付款。",
              )
            : t(
                "复制与安装不会创建订单。只有你确认具体餐食、地址、时间和总价后，才进入下单。",
              )}
        </p>
        <a
          href={locale === "en" ? "/install-guide.en.md" : "/install-guide.md"}
          target="_blank"
          rel="noreferrer"
          className="text-button"
        >
          {t("查看安装说明 ")}
          <ArrowUpRight size={14} />
        </a>
      </div>
    </div>
  );
}
function Guide({ open }: any) {
  return (
    <section className="page narrow guide">
      <div className="eyebrow">HOW TO BE PART OF IT</div>
      <h1>
        {t("从一份需要，")}
        <br />
        {t("到一餐的陪伴。")}
      </h1>
      <p className="lead">
        {t("网页帮你发现故事，你的 AI 帮你完成餐食安排。")}
        <br />A shared table, with your own AI.
      </p>
      <div className="guide-block">
        <h2>
          {t("我想发起需求 ")}
          <small>For requesters</small>
        </h2>
        <ol>
          <li>{t("在自己的 AI 中安装 Mc4Need Skill，连接本人麦当劳 MCP。")}</li>
          <li>
            {t("确认指定餐食、总份数、收货地点、用餐安排和最晚接单时间。")}
          </li>
          <li>{t("预览并确认公开信息，发布需求链接。首次无需邮箱或邀请。")}</li>
          <li>{t("收餐后在网页或 AI 确认收到，留下反馈与统一致谢。")}</li>
        </ol>
        <button className="button dark" onClick={() => open("publish")}>
          {t("复制发起指引 ")}
          <Copy size={16} />
        </button>
      </div>
      <div className="guide-block">
        <h2>
          {t("我想支持一餐 ")}
          <small>For sponsors</small>
        </h2>
        <ol>
          <li>{t("找到想支持的真实需求，复制专属指引到自己的 AI。")}</li>
          <li>
            {t("AI 读取最新需求，在你的麦当劳账号中重新核实地址、餐食和配送。")}
          </li>
          <li>
            {t(
              "查看完整总价（包含配送费），选择姓名、昵称或匿名；明确确认后整单下单。",
            )}
          </li>
          <li>
            {t("在官方入口付款，请 AI 查询并同步订单。之后查看收餐反馈。")}
          </li>
        </ol>
        <p>
          {t(
            "一人承担整单，避免多人重复配送。缺货时请发起方更新，不自行替换餐食。",
          )}
        </p>
      </div>
      <div className="guide-block">
        <h2>{t("关注餐食需求 ")}</h2>
        <p>
          {t(
            "粘贴到你的 AI，设置关注范围与频率，有合适需求时提醒。关注本身不需要麦当劳登录。",
          )}
        </p>
        <button className="button dark" onClick={() => open("watch")}>
          {t("关注餐食需求 ")}
          <Copy size={16} />
        </button>
      </div>
      <div className="guide-block">
        <h2>
          {t("想知道的几个细节 ")}
          <small>A few things to know</small>
        </h2>
        {[
          [
            t("重复的需要怎么安排？"),
            t(
              "每一期独立确认。下一期只生成草稿，重新核实菜单和配送后才可发布，不自动下单或扣款。",
            ),
          ],
          [
            t("什么时候算完成？"),
            t(
              "只有发起方确认实际收餐并返回反馈，才成为完成案例。麦当劳订单状态完成不直接等于平台完成。",
            ),
          ],
          [
            t("订单状态可靠吗？"),
            t(
              "付款和配送由赞助人客户端同步，页面标注来源与时间。AI 离线时不会持续同步，平台不宣称独立验真。",
            ),
          ],
          [
            t("想取消怎么办？"),
            t(
              "在订单记录中申请取消，同时给对方留言。赞助人操作自己的麦当劳订单；取消申请、取消成功、退款到账分别记录。",
            ),
          ],
          [
            t("必须绑定邮箱吗？"),
            t(
              "不需要。平台凭证保存在你的设备。邮件服务可用时，你可以自愿绑定邮箱用于恢复与通知。没有邮箱且本地凭证丢失，无法保证恢复。",
            ),
          ],
          [
            t("需要在网页交出麦当劳 Token 吗？"),
            t(
              "不需要。平台只接收必要的业务状态。请在官方支持的客户端配置麦当劳 MCP，不把 Token 发到聊天正文或平台。",
            ),
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <button className="button outline" onClick={() => open("install")}>
        {t("安装 CLI + Skill ")}
        <Terminal size={17} />
      </button>
    </section>
  );
}
function ErrorBox({ text }: { text: string }) {
  return (
    <div className="error" role="alert">
      {t(text)}
    </div>
  );
}
function Login({ verify, link }: any) {
  const [state, setState] = useState(t("正在验证一次性链接…"));
  useEffect(() => {
    const loginToken = location.hash.slice(1);
    history.replaceState({}, "", location.pathname);
    if (!loginToken) {
      setState(
        t(
          "链接缺失或已使用。请在 AI 中运行 mc4need auth browser 获取新的登录入口。",
        ),
      );
      return;
    }
    post(verify ? "/auth/verify" : "/auth/exchange", { token: loginToken })
      .then(() => location.replace("/dashboard"))
      .catch((e) => setState(e.message));
  }, []);
  return (
    <section className="page narrow">
      <h1>{t("回到你的这一餐。")}</h1>
      <p>{state}</p>
      {link("/guide", t("查看参与方式"), "button outline")}
    </section>
  );
}
function Dashboard({ link, open }: any) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [health, setHealth] = useState<any>({});
  const refresh = () =>
    api("/me")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
    api("/health").then(setHealth);
  }, []);
  return (
    <section className="page dashboard">
      <div className="eyebrow">YOUR SHARED TABLE</div>
      <h1>
        {t("我的记录 ")}
        <span>My space</span>
      </h1>
      {error ? (
        <div className="form-box">
          <h2>{t("从你的 AI 回到这里")}</h2>
          <p>
            {error}
            {t("。在已安装的 CLI 中运行：")}
          </p>
          <pre>mc4need auth browser</pre>
          <p>
            {t(
              "打开返回的一次性链接，即可查看你自己的需求、赞助和消息。邮箱不是首次参与的前提。",
            )}
          </p>
          <button className="button dark" onClick={() => open("install")}>
            {t("获取安装指引 ")}
            <Copy size={16} />
          </button>
          {health.email && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const r = await post("/auth/recover", { email });
                  setMsg(r.message);
                } catch (e: any) {
                  setMsg(e.message);
                }
              }}
            >
              <label>
                {t("已绑定邮箱？恢复访问")}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button className="button outline">{t("发送恢复邮件")}</button>
            </form>
          )}
          {msg && <p role="status">{msg}</p>}
        </div>
      ) : !data ? (
        <p>{t("读取记录中…")}</p>
      ) : (
        <>
          <div className="account-bar">
            <span>{data.user.email || t("访客身份 · 凭证由本机持有")}</span>
            <div>
              {data.user.admin === 1 &&
                link("/admin", t("管理后台"), "text-button")}
              <button
                className="text-button"
                onClick={async () => {
                  await post("/auth/logout");
                  location.reload();
                }}
              >
                {t("退出网页")}
              </button>
            </div>
          </div>
          <section>
            <h2>
              {t("我发起的需要 ")}
              <small>My needs</small>
            </h2>
            {data.needs.length ? (
              data.needs.map((n: Need) => (
                <div className="record" key={n.id}>
                  <div>
                    <strong>{n.title}</strong>
                    <p>
                      {statusName[n.status]} · {n.quantity}
                      {t(" 份 ·")} {date(n.mealAt)}
                    </p>
                  </div>
                  {n.status !== "draft" &&
                    link(
                      `/needs/${n.id}`,
                      <>
                        {t("查看公开页 ")}
                        <ArrowUpRight size={16} />
                      </>,
                      "text-button",
                    )}
                  {!n.demo && <CoverEditor need={n} refresh={refresh} />}
                  {n.recurringDays && (
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          const r = await post(`/needs/${n.id}/next`, {
                            confirmed: true,
                          });
                          setMsg(
                            t(
                              "已生成下一期草稿 {0}，请在 AI 重新核实后发布。",
                              [r.id],
                            ),
                          );
                          refresh();
                        } catch (e: any) {
                          setMsg(e.message);
                        }
                      }}
                    >
                      {t("生成下一期草稿")}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="muted">{t("还没有发布需求。")}</p>
            )}
          </section>
          <section>
            <h2>
              {t("订单与协作 ")}
              <small>Orders & conversations</small>
            </h2>
            {data.attempts.length ? (
              data.attempts.map((a: any) => (
                <div className="record" key={a.id}>
                  <div>
                    <strong>{JSON.parse(a.data).title}</strong>
                    <p>
                      {a.need_status === "completed"
                        ? t("已完成（发起方收餐与反馈）")
                        : statusName[a.state]}{" "}
                      · {a.display_name} ·{" "}
                      {a.last_sync
                        ? t("客户端同步 {0}", [date(a.last_sync)])
                        : t("暂无订单同步")}
                    </p>
                  </div>
                  {link(
                    `/orders/${a.id}`,
                    <>
                      {t("留言与收餐 ")}
                      <ArrowUpRight size={16} />
                    </>,
                    "button outline small",
                  )}
                </div>
              ))
            ) : (
              <p className="muted">{t("还没有赞助记录。")}</p>
            )}
          </section>
          <section>
            <div className="section-heading">
              <h2>
                {t("站内消息 ")}
                <small>Notifications</small>
              </h2>
              <button
                className="text-button"
                onClick={async () => {
                  await post("/notifications/read");
                  refresh();
                }}
              >
                {t("全部标为已读")}
              </button>
            </div>
            {data.notifications.length ? (
              data.notifications.map((n: any) => (
                <div
                  className={`notification ${n.seen ? "seen" : ""}`}
                  key={n.id}
                >
                  <span>{t(n.body)}</span>
                  <small>
                    {date(n.created_at)}
                    {n.need_id && link(`/needs/${n.need_id}`, t("查看需求 ↗"))}
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">
                {t(
                  "新的留言和状态变化会出现在这里。未绑定邮箱时，下次访问即可查看。",
                )}
              </p>
            )}
          </section>
          <section className="form-box">
            <h2>
              {t("在另一台 AI 中继续 ")}
              <small>Keep the same identity</small>
            </h2>
            <p>
              {t("下载一份私密平台凭证，在自己的电脑运行")}{" "}
              <code>{t("mc4need auth import-file 文件路径")}</code>
              {t(
                "，即可继续管理同一批需求与赞助。邮箱恢复后也可使用这个入口。",
              )}
            </p>
            <p>
              {t(
                "文件等同账号访问权限，有效期 90 天；请勿转发、上传仓库或把内容粘贴进 AI 对话。它不包含麦当劳 Token。",
              )}
            </p>
            <button
              className="button outline"
              onClick={async () => {
                try {
                  const credential = await post("/auth/cli-session", {
                    confirmed: true,
                  });
                  const objectURL = URL.createObjectURL(
                    new Blob([JSON.stringify(credential)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = objectURL;
                  a.download = "mc4need-identity.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(objectURL), 10000);
                  setMsg(t("私密凭证已准备下载。请在本机导入，保管好文件。"));
                } catch (e: any) {
                  setMsg(e.message);
                }
              }}
            >
              {t("下载私密凭证文件")}
            </button>
          </section>
          <section className="form-box">
            <h2>
              {t("可选邮箱 ")}
              <small>Stay connected, if you like</small>
            </h2>
            {data.user.email ? (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!data.user.email_notifications}
                  onChange={async (e) => {
                    await post("/preferences", {
                      emailNotifications: e.target.checked,
                    });
                    refresh();
                  }}
                />
                {t("接收订单消息邮件（可随时关闭）")}
              </label>
            ) : health.email ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await post("/auth/email", { email });
                    setMsg(t("验证邮件已发送。"));
                  } catch (e: any) {
                    setMsg(e.message);
                  }
                }}
              >
                <label>
                  {t("验证邮箱用于恢复身份与通知")}
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <button className="button outline">{t("发送验证邮件")}</button>
              </form>
            ) : (
              <p className="muted">
                {t("邮件服务尚未开放。当前使用站内通知，请保管本机凭证。")}
              </p>
            )}
          </section>
          {msg && (
            <div className="toast" role="status" onClick={() => setMsg("")}>
              {msg} <X size={16} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
function Order({ id, link }: any) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [received, setReceived] = useState(false);
  const [consent, setConsent] = useState(false);
  const refresh = () =>
    api(`/attempts/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, [id]);
  async function action(path: string, body: any) {
    try {
      await post(path, body);
      setMsg(t("已保存"));
      refresh();
      return true;
    } catch (e: any) {
      setMsg(e.message);
      return false;
    }
  }
  if (error)
    return (
      <section className="page">
        <ErrorBox text={error} />
        {link("/dashboard", t("返回记录"))}
      </section>
    );
  if (!data) return <div className="page loading">{t("正在读取订单…")}</div>;
  return (
    <section className="page narrow order">
      {link(
        "/dashboard",
        <>
          <ChevronLeft size={16} />
          {t("我的记录")}
        </>,
        "back",
      )}
      <div className="eyebrow">YOUR MEAL, TOGETHER</div>
      <h1>{data.need.title}</h1>
      <div className="status-block">
        {visibleProgress({ ...data.need, progress: { state: data.state } })} ·{" "}
        {data.isOwner ? t("你是发起方") : t("你是赞助人")}
      </div>
      <p className="muted">
        {t("上次客户端状态：")}
        {statusName[data.state]}
        {t("。来源：赞助人客户端同步 ·")}{" "}
        {data.last_sync ? date(data.last_sync) : t("尚无同步")}{locale === "en" ? "." : "。"}<br />
        {t("订单不会在 AI 离线时自动查询。")}
      </p>
      {data.issue && <ErrorBox text={data.issue} />}
      <div className="form-box">
        <h2>
          {t("订单详情与联系 ")}
          <small>Details & contact</small>
        </h2>
        <p>
          {t("支持者：")}
          {data.display_name}
        </p>
        {data.privateDelivery ? (
          <p>
            {t("收货：")}
            {data.privateDelivery.contactName} · {data.privateDelivery.phone}
            <br />
            {data.need.location.address} {data.privateDelivery.detail}
          </p>
        ) : (
          <p>{t("本次尝试已结束，私密配送信息不再显示。")}</p>
        )}
        {data.privateDelivery?.contact && (
          <p>
            {t("发起方自愿提供：")}
            {data.privateDelivery.contact}
          </p>
        )}
        {data.contact && (
          <p>
            {t("赞助人自愿提供：")}
            {data.contact}
          </p>
        )}
        {data.quote && (
          <p>
            {t("确认总价：")}
            {money(JSON.parse(data.quote).amountCents)}
            {t("（含配送")} {money(JSON.parse(data.quote).deliveryCents)}{locale === "en" ? ")" : "）"}
          </p>
        )}
        {data.pay_by && (
          <p>
            {t("付款截止：")}
            {date(data.pay_by)}
            {t("。到期后须核实官方结果，不直接释放。")}
          </p>
        )}
        <p>
          {t("取消结果：")}
          {data.cancel_result || t("未报告")}
          {t(" · 退款状态：")}
          {data.refund_state}
        </p>
      </div>
      <section className="form-box">
        <h2>
          {t("订单留言 ")}
          <small>Keep in touch</small>
        </h2>
        <div className="messages">
          {data.messages.length ? (
            data.messages.map((m: any) => (
              <div className="message" key={m.id}>
                <small>
                  {m.user_id === data.sponsor_id ? t("赞助人") : t("发起方")} ·{" "}
                  {date(m.created_at)}
                </small>
                <p>{t(m.body)}</p>
              </div>
            ))
          ) : (
            <p className="muted">{t("这份留言仅订单双方可见。")}</p>
          )}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await action(`/attempts/${id}/messages`, { body: message }))
              setMessage("");
          }}
        >
          <label>
            {t("给对方留言")}
            <textarea
              required
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button className="button dark">
            {t("发送留言 ")}
            <MessageCircle size={16} />
          </button>
        </form>
      </section>
      {data.isOwner && (
        <section className="form-box">
          <h2>
            {t("收餐确认与反馈 ")}
            <small>Close the loop</small>
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await action(`/needs/${data.need_id}/receipt`, {
                received,
                feedback,
                publicConsent: consent,
              });
            }}
          >
            <label className="checkbox">
              <input
                type="checkbox"
                checked={received}
                onChange={(e) => setReceived(e.target.checked)}
              />
              {t("我确认实际收到餐食")}
            </label>
            <label>
              {t("收餐后的反馈（可先确认收到，稍后补充）")}
              <textarea
                maxLength={2000}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={t("这一餐带来了什么？给支持者留一句话。")}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {t("我允许在需求页公开这段反馈，内容不含私人信息")}
            </label>
            <button className="button dark">
              {t("提交收餐记录 ")}
              <CheckCircle2 size={16} />
            </button>
            <p className="muted">
              {t("确认收到并返回反馈后才算完成，无需上传照片。")}
            </p>
          </form>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await action(`/needs/${data.need_id}/receipt`, {
                received: false,
                issue: reason,
                publicConsent: false,
              });
            }}
          >
            <label>
              {t("收餐有问题？")}
              <input
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("未收到、数量不符或其他问题")}
              />
            </label>
            <button className="button outline">{t("记录异常")}</button>
          </form>
        </section>
      )}
      <section className="form-box">
        <h2>
          {t("申请取消 ")}
          <small>Cancellation request</small>
        </h2>
        <p>
          {t(
            "提交申请的同时，请使用上方留言与联系方式沟通。只有赞助人能在自己的麦当劳账号操作取消。",
          )}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await action(`/attempts/${id}/cancel`, { reason });
          }}
        >
          <label>
            {t("取消原因")}
            <input
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="button outline">{t("提交取消申请")}</button>
        </form>
        <p className="muted">
          {t("申请不代表取消成功，取消成功不代表退款到账。")}
        </p>
      </section>
      {msg && (
        <div className="toast" role="status" onClick={() => setMsg("")}>
          {msg} <X size={16} />
        </div>
      )}
    </section>
  );
}
function Admin() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const refresh = () =>
    api("/admin/overview")
      .then(setData)
      .catch((e) => setMsg(e.message));
  useEffect(() => {
    refresh();
  }, []);
  return (
    <section className="page dashboard">
      <h1>
        {t("运营管理 ")}
        <span>Operations</span>
      </h1>
      {msg && <ErrorBox text={msg} />}{" "}
      {data && (
        <>
          <h2>{t("举报与反馈")}</h2>
          {data.reports.map((r: any) => (
            <div className="record" key={r.id}>
              <p>
                {r.reason}
                <small>{r.need_id}</small>
              </p>
              <button
                className="button outline small"
                disabled={r.resolved}
                onClick={async () => {
                  await post(`/admin/reports/${r.id}/resolve`);
                  refresh();
                }}
              >
                {r.resolved ? t("已处理") : t("标为已处理")}
              </button>
            </div>
          ))}
          <h2>{t("需要核实的订单")}</h2>
          {data.exceptions.map((a: any) => (
            <div className="record" key={a.id}>
              <p>
                {a.id}
                <br />
                {statusName[a.state]} ·{" "}
                {a.issue ? t(a.issue) : t("等待核实或同步")}
              </p>
            </div>
          ))}
          <h2>{t("公开内容与演示")}</h2>
          {data.needs.map((n: any) => (
            <div className="record" key={n.id}>
              <div>
                <strong>{JSON.parse(n.data).title}</strong>
                <p>
                  {n.demo ? t("演示") : t("真实")} · {n.status} ·{" "}
                  {n.hidden ? t("隐藏") : t("可见")}
                </p>
              </div>
              <button
                className="button outline small"
                onClick={async () => {
                  const reason = prompt(t("请填写处置理由"));
                  if (reason) {
                    try {
                      await post(`/admin/needs/${n.id}`, {
                        hidden: !n.hidden,
                        reason,
                      });
                      refresh();
                    } catch (e: any) {
                      setMsg(e.message);
                    }
                  }
                }}
              >
                {n.hidden ? t("恢复显示") : t("隐藏内容")}
              </button>
            </div>
          ))}
          <h2>{t("操作记录")}</h2>
          {data.audit.map((a: any, i: number) => (
            <p className="muted" key={i}>
              {date(a.created_at)} · {a.action} · {a.target}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
function Privacy() {
  return (
    <section className="page narrow guide">
      <div className="eyebrow">PRIVACY & EXPECTATIONS</div>
      <h1>
        {t("清楚地参与，")}
        <br />
        {t("放心地分享。")}
      </h1>
      <div className="guide-block">
        <h2>{t("平台保存什么 / What we keep")}</h2>
        <p>
          {t(
            "公开需求包括经发起方确认的故事、指定餐食、份数、时间、地点地址和地图。姓名、昵称或匿名署名由赞助人选择；完成反馈由发起方确认公开。",
          )}
        </p>
        <p>
          {t(
            "平台另存身份凭证的哈希、加密的配送联系人及补充资料、双方留言、最小订单状态与操作记录。私密收货信息仅用于订单双方协作。麦当劳实际订单中的接收人信息会出现在赞助人的麦当劳账号里。",
          )}
        </p>
        <p>
          {t(
            "平台不接收麦当劳 Token，不保存官方支付链接或完整官方订单响应。不要把密码、验证码、Token 或私密个人信息放进公开故事与反馈。",
          )}
        </p>
      </div>
      <div className="guide-block">
        <h2>{t("身份与通知 / Identity & messages")}</h2>
        <p>
          {t(
            "首次使用建立本机访客凭证。它代表平台操作权限，不是实名或机构资质认证。网页通过短时一次性链接登录。未绑定邮箱且本机凭证丢失时，无法保证找回。",
          )}
        </p>
        <p>
          {t(
            "邮箱功能以页面可用状态为准，自愿验证后可用于恢复与通知，通知可关闭。站内通知在你访问网页或 AI 查询时可见；不承诺离线即时触达。",
          )}
        </p>
      </div>
      <div className="guide-block">
        <h2>{t("理解展示内容 / Understand what you see")}</h2>
        <p>
          {t(
            "“演示案例 · 模拟完成”中的故事、数量、致谢与状态都是虚构的，不计入真实统计。真实需求的付款配送状态来自赞助人客户端，平台标明来源与同步时间，不提供独立验真或实时物流保证。",
          )}
        </p>
        <p>
          {t(
            "每次下单前，应在官方当前可执行的菜单、配送和预约范围内确认。赞助人使用本人账号，实际订单和退款按官方服务处理。Mc4Need 是独立开发者项目，非麦当劳官方服务。",
          )}
        </p>
      </div>
      <div className="guide-block">
        <h2>{t("内容处理与联系 / Content & contact")}</h2>
        <p>
          {t(
            "可在每个公开需求页提交问题反馈。管理员可隐藏内容并保留处置记录。需要处理账号数据时，请通过已登录的订单留言或 CLI 凭证证明你持有该平台身份；不要在公开 GitHub Issue 粘贴收货资料。",
          )}
        </p>
        <a
          href={`${REPO}/issues`}
          target="_blank"
          rel="noreferrer"
          className="text-button"
        >
          {t("项目问题与产品反馈 ")}
          <ArrowUpRight size={16} />
        </a>
      </div>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
