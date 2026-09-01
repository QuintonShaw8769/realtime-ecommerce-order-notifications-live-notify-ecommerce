import { createServer, type ServerResponse } from "node:http";
import { InfraiError, InfraiRealtimeClient } from "./infrai_realtime.js";
import {
  browserSessionSchema,
  notificationFor,
  orderUpdateSchema,
} from "./order_notification.js";

const apiKey = process.env.INFRAI_API_KEY ?? "";
const realtime = new InfraiRealtimeClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/order-updates") {
      const parsed = orderUpdateSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        json(response, 400, { ok: false, issues: parsed.error.issues });
        return;
      }

      const notification = notificationFor(parsed.data);
      await realtime.publish(
        notification.channel,
        notification.event,
        {
          title: notification.title,
          message: notification.message,
          order_id: notification.order_id,
        },
        parsed.data.customer_id,
        notification.update_id,
      );
      json(response, 202, { ok: true, notification });
      return;
    }

    if (request.method === "POST" && request.url === "/browser-sessions") {
      const body = await readJson(request);
      const parsed = browserSessionSchema.safeParse(body);
      if (!parsed.success) {
        json(response, 400, { ok: false, issues: parsed.error.issues });
        return;
      }
      const channel = `customer:${parsed.data.customer_id}:orders`;
      await realtime.createChannel(channel, `channel:${parsed.data.customer_id}`);
      const token = await realtime.issueBrowserToken(parsed.data.customer_id, channel);
      json(response, 200, { ok: true, channel, token });
      return;
    }

    json(response, 404, { ok: false, message: "Route not found" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      json(response, 400, { ok: false, message: "Request body must be valid JSON" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, {
        ok: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    json(response, 502, { ok: false, message: "Notification delivery failed" });
  }
});

server.listen(port, () => {
  console.log(`Order notification service listening on http://localhost:${port}`);
});
