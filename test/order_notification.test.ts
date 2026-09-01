import assert from "node:assert/strict";
import test from "node:test";
import { notificationFor, orderUpdateSchema } from "../src/order_notification.js";

test("a shipped fulfillment becomes a private customer order notification", () => {
  const update = orderUpdateSchema.parse({
    kind: "fulfillment_shipped",
    update_id: "evt_ship_1042",
    order_id: "order_1042",
    customer_id: "customer_73",
    carrier: "Parcel Post",
    tracking_number: "PP1042008",
  });

  assert.deepEqual(notificationFor(update), {
    channel: "customer:customer_73:orders",
    event: "order.shipped",
    title: "Your order is moving",
    message: "Parcel Post is carrying order order_1042. Tracking: PP1042008.",
    order_id: "order_1042",
    update_id: "evt_ship_1042",
  });
});
