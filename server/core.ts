import { z } from "zod";
export const now = () => Date.now();
export const id = () => crypto.randomUUID();
export const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
export async function seal(data: unknown, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(data)),
    ),
  );
  return btoa(String.fromCharCode(...iv, ...ct));
}
export async function unseal(data: string, secret: string) {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  return JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes.slice(0, 12) },
        key,
        bytes.slice(12),
      ),
    ),
  );
}
const text = (n: number) => z.string().trim().min(1).max(n);
export const needSchema = z
  .object({
    title: text(80),
    story: text(2000),
    organizer: text(80),
    scene: z.enum(["birthday", "training", "basketball", "other"]),
    meals: z
      .array(
        z
          .object({
            name: text(120),
            quantity: z.number().int().min(1).max(500),
            specification: text(300),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    location: z
      .object({
        name: text(100),
        address: text(240),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .strict(),
    mealAt: z.number().int().positive(),
    acceptBy: z.number().int().positive(),
    referenceCents: z.number().int().min(0).max(10000000).nullable(),
    referenceAt: z.number().int().positive().nullable(),
    recurringDays: z.number().int().min(1).max(365).nullable(),
    privateDelivery: z
      .object({
        contactName: text(80),
        phone: text(30),
        detail: z.string().max(500),
        contact: z.string().max(160).optional(),
      })
      .strict(),
    consent: z.literal(true),
    deliveryCheckedAt: z.number().int().positive(),
  })
  .strict()
  .refine((d) => d.acceptBy < d.mealAt, "接单截止须早于用餐时间");
export const quoteSchema = z
  .object({
    amountCents: z.number().int().min(1).max(10000000),
    deliveryCents: z.number().int().min(0).max(1000000),
    summary: text(2000),
    checkedAt: z.number().int().positive(),
    needVersion: z.number().int(),
    exactMenuConfirmed: z.literal(true),
  })
  .strict();
export const syncSchema = z
  .object({
    key: text(100),
    orderId: text(150),
    createdAt: z.number().int().positive(),
    officialExpiry: z.number().int().positive().nullable(),
    status: z.enum([
      "pending",
      "paid",
      "preparing",
      "delivering",
      "delivered",
      "cancelled",
      "expired",
      "unknown",
    ]),
    observedAt: z.number().int().positive(),
    unpaidConfirmed: z.boolean().optional(),
    cancelResult: z
      .enum(["requested", "failed", "unknown", "succeeded"])
      .optional(),
    refundState: z
      .enum(["unknown", "pending", "partial", "refunded", "not_applicable"])
      .optional(),
  })
  .strict();
export function payDeadline(
  created: number,
  expiry: number | null,
  seconds: number,
) {
  return Math.min(created + seconds * 1000, expiry ?? Infinity);
}
export function classifySync(
  status: string,
  created: number,
  accept: number,
  paidBefore: boolean,
) {
  if (status === "unknown") return { state: "uncertain", release: false };
  if (status === "cancelled" || status === "expired")
    return { state: status, release: !paidBefore };
  if (created > accept) return { state: "late", release: false };
  return { state: status, release: false };
}
export const paidStates = ["paid", "preparing", "delivering", "delivered"];
export function canExpireQuote(a: any, time: number) {
  return a.state === "quoting" && a.lock_until < time;
}
