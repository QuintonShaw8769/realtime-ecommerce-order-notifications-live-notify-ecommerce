import { InfraiRealtimeClient } from "../src/infrai_realtime.js";
import { notificationFor, orderUpdateSchema } from "../src/order_notification.js";

const update = orderUpdateSchema.parse({
  kind: "fulfillment_shipped",
  update_id: "evt_ship_1042",
  order_id: "order_1042",
  customer_id: "customer_73",
  carrier: "Parcel Post",
  tracking_number: "PP1042008",
});

const notification = notificationFor(update);
const realtime = new InfraiRealtimeClient(process.env.INFRAI_API_KEY ?? "");

await realtime.createChannel(
  notification.channel,
  `channel:${notification.channel}`,
);

await realtime.publish(
  notification.channel,
  notification.event,
  {
    title: notification.title,
    message: notification.message,
    order_id: notification.order_id,
  },
  update.customer_id,
  update.update_id,
);

console.log(JSON.stringify({ published: true, notification }, null, 2));
