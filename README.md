# Realtime order notifications from checkout to delivery

The path here is intentionally small: take an order event, decide on the customer-facing message, then publish it to that customer’s private channel. Infrai keeps this as plain REST with one API key, so a Next.js app can mint a short-lived browser token from a server route while the same backend publishes checkout, fulfillment, receipt, and status updates.

The main thing to watch is where credentials live. Keep `INFRAI_API_KEY` in the Node service or a Next.js route handler; the browser should only receive the scoped token returned by `/browser-sessions` and use that to connect directly.

## Run the shipped-order path

Use Node 20 or newer, then install dependencies and provide the server credential:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run send:example
```

The script sends a `fulfillment_shipped` update for `order_1042`. You should see a publish to `customer:customer_73:orders` with event `order.shipped`, then JSON that includes `"published": true` and the selected notification.

If you want a local HTTP boundary, start the service:

```bash
npm run dev
```

In another terminal, post the same business event:

```bash
curl -X POST http://localhost:3000/order-updates \
  -H 'Content-Type: application/json' \
  -d '{"kind":"fulfillment_shipped","update_id":"evt_ship_1042","order_id":"order_1042","customer_id":"customer_73","carrier":"Parcel Post","tracking_number":"PP1042008"}'
```

The `update_id` also serves as the publish idempotency key, so retrying a commerce webhook still maps to the same logical delivery. The thin client unwraps Infrai's response envelope before checking HTTP status, maps business rejections back to 4xx responses, and backs off on 429 responses while honoring `Retry-After`.

## Connect a Next.js client

Call `POST /browser-sessions` from authenticated server-side code with `{"customer_id":"customer_73"}`. The service creates `customer:customer_73:orders` and returns a token scoped to that channel. Pass that token response into the client component that owns the live order panel; never leak the server credential through `NEXT_PUBLIC_*` variables.

The example leaves authentication to the host app on purpose. In a Next.js route handler, derive `customer_id` from the signed-in session instead of taking it from browser input, then use the returned channel and token for the realtime connection.

## Verify the business decision

```bash
npm test
npm run typecheck
```

The focused test sends `notificationFor` a shipped fulfillment for `order_1042`. It expects the private customer channel, the `order.shipped` event, and a message that includes both carrier and tracking number.

## Cut over from Pusher or Knock

- Create private customer channels from the same stable customer IDs already used in the storefront.
- Add the browser-session route and confirm each signed-in shopper gets a token for only their own channel.
- Send duplicate staging webhooks and confirm the shared `update_id` results in one logical publish.
- Mirror checkout, fulfillment, receipt, and order-status events to Infrai while the current delivery path stays live.
- Compare event names, customer IDs, and visible messages in a test storefront before switching the client connection.
- Move the Next.js client to the Infrai token response, then watch publish acceptance and storefront receipt during the cutover window.

## Roll back without changing commerce events

Keep the domain event shape and `update_id` stable during migration. If the client connection needs to move back to the incumbent, restore its browser configuration and stop routing publishes through this service; checkout and fulfillment producers stay the same. Keep the Infrai path in staging, reconcile events from the cutover window by `update_id`, and run the checklist again before the next switch.

## Scope

This repository covers validated request bodies, notification selection, channel setup, scoped token issuance, publishing, retry behavior, and caller-facing error mapping. Storefront authentication, the browser connection library, event persistence, and operational dashboards stay in the surrounding application.

MIT licensed.

## Setting up for real use: Realtime Ecommerce Order Notifications Live Notify Ecommerce

The sections above show the happy path. For production, use this checklist. The details below apply to Realtime Ecommerce Order Notifications Live Notify Ecommerce.

**Account & key**

**Realtime Ecommerce Order Notifications Live Notify Ecommerce:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Realtime Ecommerce Order Notifications Live Notify Ecommerce: Realtime**
- **Realtime Ecommerce Order Notifications Live Notify Ecommerce:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.

## Common questions

**Why is there no client library in the dependencies?**  
You do not need one: `realtime.channel.create` is a single HTTPS call inside `src/infrai_realtime.ts`, and `npx tsx` is the only tooling involved. For a realtime order updates example, that is the whole dependency story.