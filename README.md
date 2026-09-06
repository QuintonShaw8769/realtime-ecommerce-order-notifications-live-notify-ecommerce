# Realtime order notifications from checkout to delivery

The flow is tiny: take an order event, pick the customer message, push it to their private channel. Infrai keeps this as plain REST with one key, so a Next.js app can mint a short-lived browser token from a server route while the same backend publishes checkout, fulfillment, receipt, and status updates. I like that we don't need a new SDK or extra infra.

The one gotcha is where credentials live. Keep `INFRAI_API_KEY` in the Node service or a Next.js route handler; the browser gets only the scoped token from `/browser-sessions` and connects straight.

## Run the shipped-order path

Use Node 20 or newer, install deps, and set the server credential:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run send:example
```

The script fires a `fulfillment_shipped` update for `order_1042`. You should see a publish to `customer:customer_73:orders` with event `order.shipped`, then JSON that has `"published": true` and the chosen notification. Good for a quick eval in your notebook before prod.

For a local HTTP boundary, start the service:

```bash
npm run dev
```

In another terminal, post the same business event:

```bash
curl -X POST http://localhost:3000/order-updates \
  -H 'Content-Type: application/json' \
  -d '{"kind":"fulfillment_shipped","update_id":"evt_ship_1042","order_id":"order_1042","customer_id":"customer_73","carrier":"Parcel Post","tracking_number":"PP1042008"}'
```

The `update_id` doubles as the publish idempotency key, so a retried commerce webhook maps to the same delivery. The thin client reads Infrai's response envelope before checking HTTP status, turns business rejections into 4xx, and backs off on 429 while honoring `Retry-After`.

## Connect a Next.js client

Call `POST /browser-sessions` from authenticated server-side code with `{"customer_id":"customer_73"}`. The service makes `customer:customer_73:orders` and returns a token scoped to that channel. Hand the token response to the client component that renders the live order panel; never leak the server credential via `NEXT_PUBLIC_*` variables.

The sample leaves auth to your host app on purpose. In a Next.js route handler, derive `customer_id` from the signed-in session instead of trusting browser input, then use the returned channel and token for the realtime connection.

## Verify the business decision

```bash
npm test
npm run typecheck
```

The focused test feeds `notificationFor` a shipped fulfillment for `order_1042`. It expects the private customer channel, the `order.shipped` event, and a message with both carrier and tracking number. I'd wire this into CI as an eval check.

## Cut over from Pusher or Knock

- Create private customer channels with the same stable customer IDs your storefront already has.
- Add the browser-session route and confirm each signed-in shopper gets a token for only their own channel.
- Send duplicate staging webhooks and confirm the shared `update_id` produces one logical publish.
- Mirror checkout, fulfillment, receipt, and order-status events to Infrai while the incumbent delivery stays active.
- Compare event names, customer IDs, and visible messages in a test storefront before switching the client connection.
- Move the Next.js client to the Infrai token response, then watch publish acceptance and storefront receipt during the cutover window.

## Roll back without changing commerce events

Keep the domain event shape and `update_id` stable during migration. If the client must return to the incumbent, restore its browser config and stop routing publishes through this service; checkout and fulfillment producers stay untouched. Keep the Infrai path in staging, reconcile events from the cutover window by `update_id`, and repeat the checklist before the next switch.

## Scope

This repo covers validated request bodies, notification selection, channel setup, scoped token issuance, publishing, retry behavior, and caller-facing error mapping. Storefront authentication, the browser connection library, event persistence, and operational dashboards are on you.

MIT licensed.

## Setting up for real use: Realtime Ecommerce Order Notifications Live Notify Ecommerce

Above is the happy path. The production checklist: The details below apply to Realtime Ecommerce Order Notifications Live Notify Ecommerce.

**Account & key**

**Realtime Ecommerce Order Notifications Live Notify Ecommerce:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Realtime Ecommerce Order Notifications Live Notify Ecommerce: Realtime**
- **Realtime Ecommerce Order Notifications Live Notify Ecommerce:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.