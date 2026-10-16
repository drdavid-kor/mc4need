# CLI & MCP workflow reference

All times are Unix milliseconds. All amounts are integer CNY cents. Actual tool schemas are authoritative; inspect them in the host client. This CLI never connects directly to McDonald's.

## Publish

1. Clarify the exact meal(s), headcount, city, permitted receiver details, public place/address/coordinates, delivery time and acceptance cutoff. Ask for publication and standardized thanks consent. No email requirement.
2. Use `delivery-query-addresses` or `delivery-create-address` in the requester's account (creation writes to their account; confirm the actual receiving details). Then `delivery-query-stores` with the account addressId. Delivery `orderType=2`; `beType=2` for McDelivery or `6` for group meals when actually supported. Do not use `query-nearby-stores` for delivery or `party-order-create` for group meals.
3. Inspect available reservation options, `query-meals`, `query-meal-detail`, and required selections/roundList. For `beType=6`, query available meal assistance before calculation and carry the selected gmServiceCode as required. Calculate a reference price in that account. If the time or quantity is not currently executable, keep a draft.
4. Create via `mc4need needs create`, JSON on stdin:

```json
{
  "title":"决赛后的这一餐",
  "story":"由用户确认可公开的真实故事",
  "organizer":"已获授权使用的名称",
  "scene":"basketball",
  "meals":[{"name":"实际在售套餐名","quantity":30,"specification":"明确汉堡、配餐、饮品及规格，不使用占位餐单下单"}],
  "location":{"name":"公开地点名称","address":"公开街道地址","lat":31.2,"lng":121.4},
  "mealAt":1792300000000,
  "acceptBy":1792290000000,
  "referenceCents":90000,
  "referenceAt":1792280000000,
  "recurringDays":null,
  "privateDelivery":{"contactName":"用户授权的联系人","phone":"用户提供的真实电话","detail":"私人门牌或送达说明","contact":"自愿提供的双方联系渠道"},
  "consent":true,
  "deliveryCheckedAt":1792280000000
}
```

The example dates and data are **format examples only**, not real order instructions. scene is birthday/training/basketball/other. referenceCents/referenceAt and recurringDays may be null. Total quantity is computed by server. Update with `needs update ID` using the full same schema; updates invalidate the old confirmation and return to draft. Existing active sponsor prevents changing need data.
5. Show publication preview. On confirmation use `needs publish ID` with `{"version":1,"confirmed":true}`. Delivery check must be within 30 minutes and acceptance cutoff in the future. Return the public URL. For recurring needs, `needs next ID` + `{"confirmed":true}` creates only one next draft and clears verification and price.

## Sponsor

1. `needs show ID`, reject demos/unavailable status. Ask sponsor display name (or “匿名支持者”) and optional counterpart-only contact.
2. `needs claim ID` with `{"version":1,"displayName":"昵称","contact":"可选联系资料"}`. This obtains an exclusive five-minute quotation lock and private recipient fields. Only claiming has occurred, **no order**. Don't publish these private fields in chat outside this user's private session.
3. Create/select receiver address in sponsor account, query delivery stores/menu/details and calculate **all specified quantities**, exact component choices, delivery costs and reservation slot. Don't reuse requester IDs. If unavailable use `orders unavailable ATTEMPT_ID` + `{"reason":"具体缺货或配送问题"}`.
4. `orders quote ATTEMPT_ID` with `{"amountCents":95000,"deliveryCents":5000,"summary":"完整餐食、数量与送达安排的简述，不含私密地址电话","checkedAt":1792280000000,"needVersion":1,"exactMenuConfirmed":true}`. Save returned revision. Confirm current full order/address/time/amount with user. If they leave before creation, `orders release ATTEMPT_ID` releases the quotation lock. After timeout, reclaim and recalculate.
5. `orders creating ATTEMPT_ID` + `{"revision":2,"confirmed":true}`. Only a successful fresh acknowledgement authorizes the next single MCP create call. A retry yields conflict; inspect `orders show` instead. User confirmation is not a platform guarantee of official acceptance.
6. Call `create-order` once with parameters from the live official schemas. Parse actual creation time and expiry from the official response; do not use current platform receipt time as creation time. If creation response is lost, `orders uncertain ATTEMPT_ID`, inspect `order-list` and `query-order`, match account/order/details. Never select an unrelated historical order. If no authoritative result can be found, keep locked and contact operations. No automatic manual unlock path.
7. Sync only allowlisted fields via `orders sync ATTEMPT_ID`:

```json
{"key":"unique-observation-id","orderId":"official-order-id","createdAt":1792280000000,"officialExpiry":1792280600000,"status":"pending","observedAt":1792280001000}
```

Map official order status based on actual current response/schema: known values 1 pending, 2 paid/preparing, 4 delivering, 6 or 8 delivered, 7 cancelled, 10 preparing. Unknown codes -> unknown, **not completed**. Use `expired` only when official outcome confirms no longer payable. For cancelled/expired reports, add `"unpaidConfirmed":true` only if official evidence confirms the order was never paid; otherwise it remains closed to replacement and requires reconciliation. Optional cancelResult: requested/failed/unknown/succeeded. Optional refundState: unknown/pending/partial/refunded/not_applicable. Don't infer refund from cancellation. The same key is idempotent. orderId is hashed server-side. Do not send raw payload, official payment URL, accountId or Token.
8. Present official payH5Url directly to the user, let them pay in official flow. Current platform configurable payment window is 600 seconds, shortened by any official expiry; this is a platform policy, not a verified official TTL. If platform returns late/uncertain/issue, reconcile before payment. If timer elapses, query and, when user authorizes, cancel officially; don't release while official order may remain payable. Query again after user payment and sync. Then offer one-use webpage link and optionally email (if enabled).

## Collaboration and completion

- `orders show ATTEMPT_ID`: private order, receiver, counterpart contact, messages, observation history.
- `orders message ATTEMPT_ID` with `{"body":"message"}`. Only both parties can read.
- `orders cancel ATTEMPT_ID` with `{"reason":"reason"}` requests cancellation **and** returns contactPath. Give the contact path immediately. Sponsor must confirm official cancellation action, call `cancel-order`, query result, sync cancel/refund separately. Requester cannot operate sponsor MCP.
- `needs receipt NEED_ID` with `{"received":true,"feedback":"经授权公开的收餐反馈","publicConsent":true}`. Requester only. Omit feedback to record receipt now and add feedback later. Use `{"received":false,"issue":"收餐异常","publicConsent":false}` for failure. A completed record cannot have feedback silently overwritten; later issues remain visible.
- `notifications list` / `notifications read`, `auth browser`, optional `auth email` with `{"email":"actual-user-email"}`. No email extraction from accounts without permission.

## Installation and diagnostics

`doctor` proves CLI/platform availability only. It does not prove skill auto-discovery, MCP authorization, restaurant availability, ordering, payment or delivery. Report these separately. `identity export-file /absolute/private/path` writes a private backup without printing its token. `auth revoke` revokes every platform session and login link; the local identity is then removed. Uninstall preserves identity unless user explicitly deletes it.
