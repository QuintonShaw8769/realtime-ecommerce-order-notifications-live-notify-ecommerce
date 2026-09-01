import { z } from "zod";

export const orderUpdateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("checkout_completed"),
    update_id: z.string().min(1),
    order_id: z.string().min(1),
    customer_id: z.string().min(1),
    total: z.number().nonnegative(),
    currency: z.string().length(3),
  }),
  z.object({
    kind: z.literal("fulfillment_shipped"),
    update_id: z.string().min(1),
    order_id: z.string().min(1),
    customer_id: z.string().min(1),
    carrier: z.string().min(1),
    tracking_number: z.string().min(1),
  }),
  z.object({
    kind: z.literal("receipt_ready"),
    update_id: z.string().min(1),
    order_id: z.string().min(1),
    customer_id: z.string().min(1),
    receipt_id: z.string().min(1),
  }),
  z.object({
    kind: z.literal("order_updated"),
    update_id: z.string().min(1),
    order_id: z.string().min(1),
    customer_id: z.string().min(1),
    status: z.enum(["confirmed", "processing", "delivered", "cancelled"]),
  }),
]);

export const browserSessionSchema = z.object({
  customer_id: z.string().min(1),
});

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

export type Notification = {
  channel: string;
  event: string;
  title: string;
  message: string;
  order_id: string;
  update_id: string;
};

export function notificationFor(update: OrderUpdate): Notification {
  const base = {
    channel: `customer:${update.customer_id}:orders`,
    order_id: update.order_id,
    update_id: update.update_id,
  };

  switch (update.kind) {
    case "checkout_completed":
      return {
        ...base,
        event: "order.checkout_completed",
        title: "Order confirmed",
        message: `Order ${update.order_id} was placed for ${update.total.toFixed(2)} ${update.currency.toUpperCase()}.`,
      };
    case "fulfillment_shipped":
      return {
        ...base,
        event: "order.shipped",
        title: "Your order is moving",
        message: `${update.carrier} is carrying order ${update.order_id}. Tracking: ${update.tracking_number}.`,
      };
    case "receipt_ready":
      return {
        ...base,
        event: "order.receipt_ready",
        title: "Receipt ready",
        message: `Receipt ${update.receipt_id} is ready for order ${update.order_id}.`,
      };
    case "order_updated":
      return {
        ...base,
        event: "order.status_changed",
        title: "Order updated",
        message: `Order ${update.order_id} is now ${update.status}.`,
      };
  }
}
