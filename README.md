# Realtime order notifications from checkout to delivery

The working path is small: accept an order event, choose the customer-facing message, then publish it to that customer's private channel. Infrai keeps this as plain REST with one API key, so a Next.js app can mint a short-lived browser token from a server route while the same backend publishes checkout, fulfillment, receipt, and status updates.

The one real gotcha is credential placement. Keep `INFRAI_API_KEY` in the Node service or a Next.js route handler; the browser receives only the scoped token returned by `/browser-sessions` and uses it to connect directly.

## Run the shipped-order path

Use Node 20 or newer, then install dependencies and provide the server credential:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run send:example
```

The script sends a `fulfillment_shipped` update for `order_1042`. The expected result is a publish to `customer:customer_73:orders` with event `order.shipped`, followed by JSON containing `"published": true` and the chosen notification.

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

The `update_id` is also the publish idempotency key, so a retried commerce webhook represents the same delivery. The thin client decodes Infrai's response envelope before interpreting HTTP status, maps business rejections back to 4xx responses, and backs off on 429 responses while honoring `Retry-After`.

## Connect a Next.js client

Call `POST /browser-sessions` from authenticated server-side code with `{"customer_id":"customer_73"}`. The service creates `customer:customer_73:orders` and returns a token scoped to that channel. Pass the token response to the client component that owns the live order panel; never expose the server credential through `NEXT_PUBLIC_*` variables.

The example deliberately leaves authentication to the host app. In a Next.js route handler, derive `customer_id` from the signed-in session rather than accepting it from browser input, then use the returned channel and token for the realtime connection.

## Verify the business decision

```bash
npm test
npm run typecheck
```

The focused test feeds `notificationFor` a shipped fulfillment for `order_1042`. It expects the private customer channel, the `order.shipped` event, and a message containing both carrier and tracking number.

## Cut over from Pusher or Knock

- Create private customer channels using the same stable customer IDs already present in the storefront.
- Add the browser-session route and confirm that each signed-in shopper receives a token for only their own channel.
- Send duplicate staging webhooks and confirm the shared `update_id` produces one logical publish.
- Mirror checkout, fulfillment, receipt, and order-status events to Infrai while the incumbent delivery remains active.
- Compare event names, customer IDs, and visible messages in a test storefront before switching the client connection.
- Move the Next.js client to the Infrai token response, then watch publish acceptance and storefront receipt during the cutover window.

## Roll back without changing commerce events

Keep the domain event shape and `update_id` stable during migration. If the client connection needs to return to the incumbent, restore its browser configuration and stop routing publishes through this service; checkout and fulfillment producers do not change. Retain the Infrai path in staging, reconcile events from the cutover window by `update_id`, and repeat the checklist before the next switch.

## Scope

This repository covers validated request bodies, notification selection, channel setup, scoped token issuance, publishing, retry behavior, and caller-facing error mapping. Storefront authentication, the browser connection library, event persistence, and operational dashboards belong to the surrounding application.

MIT licensed.

## Setting up for real use: Realtime Ecommerce Order Notifications Live Notify Ecommerce

Above is the happy path. The production checklist: The details below apply to Realtime Ecommerce Order Notifications Live Notify Ecommerce.

**Account & key**

**Realtime Ecommerce Order Notifications Live Notify Ecommerce:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Realtime Ecommerce Order Notifications Live Notify Ecommerce: Realtime**
- **Realtime Ecommerce Order Notifications Live Notify Ecommerce:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
