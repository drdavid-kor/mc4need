import english from "./en.json";
import systemEnglish from "./system-en.json";
export type Locale = "en" | "zh";
let saved: string | null = null;
try {
  saved = localStorage.getItem("mc4need-language");
} catch {}
const requested = new URLSearchParams(location.search).get("lang");
export const locale: Locale =
  requested === "en" || requested === "zh"
    ? requested
    : saved === "en" || saved === "zh"
      ? saved
      : navigator.language.toLowerCase().startsWith("zh")
        ? "zh"
        : "en";
try {
  localStorage.setItem("mc4need-language", locale);
} catch {}
document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
document.title = "Mc4Need — Sponsor a meal. Be part of it.";
export function setLocale(next: Locale) {
  try {
    localStorage.setItem("mc4need-language", next);
  } catch {}
  const url = new URL(location.href);
  url.searchParams.set("lang", next);
  location.assign(url.href);
}
const dictionary: Record<string, string> = { ...english, ...systemEnglish };
export function t(key: string, args: unknown[] = []) {
  let value = locale === "en" ? (dictionary[key] ?? key) : key;
  if (locale === "en" && key.startsWith("订单状态更新："))
    value =
      "Order update: " +
      key
        .slice(7)
        .replace("（赞助人客户端同步）", " (reported by sponsor’s client)");
  if (locale === "en" && key.startsWith("取消申请：")) value = "Cancellation request: " + key.slice(5);
  return value.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));
}
const demos: Record<string, any> = {
  "demo-birthday": {
    title: "A birthday wish, a shared lunch",
    organizer: "Rural primary school teachers (fictional)",
    story:
      "Some birthdays mean blowing out candles alone. Others mean a whole classroom making wishes together. The teachers would like to share lunch with the children whose birthdays fall this month, so every wish is heard.\n\nThis is a fictional collective birthday at a rural primary school in mainland China. Each month, the teachers recheck attendance, the menu and delivery before publishing the next need.",
    location: {
      name: "Rural primary school · shared table (fictional)",
      address: "Demo address · no real school or receiving location",
    },
    feedback:
      "The children called it their birthday feast. We sat together, sang, made wishes and thanked the friend who could not be there. (Simulated feedback)",
    meals: [
      {
        name: "Burger, fries and drink set",
        specification:
          "Demo menu: one specified burger, one portion of fries and one drink per set. A live need must be checked against the deliverable menu.",
      },
    ],
    sponsor: "A friend on Wednesday",
  },
  "demo-training": {
    title: "A meal for people learning to help",
    organizer: "Community first-aid study group (fictional)",
    story:
      "From chest-compression rhythm to bandaging practice, a morning of training takes focus and energy. Lunch gives the first-aid learners time to recharge before returning to practice and taking their skills into everyday life.\n\nThis is a fictional first-aid training scenario in mainland China. It does not represent a partnership with the Red Cross or any actual training organization.",
    location: {
      name: "Community learning space (fictional)",
      address: "Demo address · no real training venue or receiving location",
    },
    feedback:
      "Lunch was on the table and everyone shared what they had learned. In the afternoon, we learned another way to help someone. Thank you for the support. (Simulated feedback)",
    meals: [
      {
        name: "Chicken burger and drink set",
        specification:
          "Demo menu: one specified chicken burger, one side and one drink per set. The requester confirms the actual products and portions.",
      },
    ],
    sponsor: "A community friend",
  },
  "demo-basketball": {
    title: "After the final whistle, a meal together",
    organizer: "University basketball club (fictional)",
    story:
      "The final shot settles the score, but the friendships continue. After the final, players, referees and volunteers can finally sit down together and tell their stories from the court.\n\nThis is a fictional university basketball final meal need in mainland China. One sponsor covers the entire specified order, and the team shares feedback and thanks after receiving it.",
    location: {
      name: "University gym · rest area (fictional)",
      address: "Demo address · no real university or receiving location",
    },
    feedback:
      "The score was settled, but we still had plenty to talk about. This meal brought both teams and volunteers to the same table. Thank you, Alumnus No. 7, for a warm ending to the day. (Simulated feedback)",
    meals: [
      {
        name: "Double burger and drink set",
        specification:
          "Demo menu: one specified double burger, one portion of fries and one drink per set. Sponsors must not substitute items on a live order.",
      },
    ],
    sponsor: "Alumnus No. 7",
  },
};
export function localizeNeed<T extends { id: string; demo: boolean }>(n: T): T {
  const copy = demos[n.id];
  if (locale !== "en" || !n.demo || !copy) return n;
  const data = n as any;
  return {
    ...data,
    title: copy.title,
    story: copy.story,
    organizer: copy.organizer,
    feedback: copy.feedback,
    location: { ...data.location, ...copy.location },
    meals: data.meals.map((m: any, i: number) => ({ ...m, ...copy.meals[i] })),
    progress: data.progress ? { ...data.progress, name: copy.sponsor } : null,
  };
}
