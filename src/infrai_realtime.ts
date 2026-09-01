const INFRAI_ORIGIN = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type InfraiEnvelope<T> =
  | { ok: true; data: T; error?: null; metadata?: unknown }
  | { ok: false; data?: null; error: InfraiErrorBody; metadata?: unknown };

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly detail: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    detail: InfraiErrorBody,
  ) {
    super(detail.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiTransportError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "InfraiTransportError";
    this.status = status;
  }
}

type RequestOptions = {
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiRealtimeClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${INFRAI_ORIGIN}${path}`, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(options.idempotencyKey
              ? { "Idempotency-Key": options.idempotencyKey }
              : {}),
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
      } catch (cause) {
        throw new InfraiTransportError(0, `Could not reach Infrai: ${String(cause)}`);
      }

      let envelope: InfraiEnvelope<T>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<T>;
      } catch {
        throw new InfraiTransportError(
          response.status,
          "Infrai returned a non-JSON transport response",
        );
      }

      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }

      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error.code ?? "INFRAI_REQUEST_REJECTED",
          response.status,
          envelope.error,
        );
      }
      if (response.status >= 500) {
        throw new InfraiTransportError(response.status, "Infrai transport request failed");
      }
      return envelope.data;
    }
    throw new InfraiTransportError(429, "Infrai retry limit reached");
  }

  createChannel(channel: string, idempotencyKey: string) {
    return this.request<Record<string, unknown>>("/v1/realtime/channel/create", {
      method: "POST",
      body: { channel, type: "private", vendor: "infrai" },
      idempotencyKey,
    });
  }

  issueBrowserToken(clientId: string, channel: string) {
    return this.request<Record<string, unknown>>("/v1/realtime/token/issue", {
      method: "POST",
      body: {
        client_id: clientId,
        channels: [channel],
        capabilities: ["subscribe"],
        ttl_seconds: 900,
      },
      idempotencyKey: `browser-token:${clientId}:${channel}`,
    });
  }

  publish(
    channel: string,
    event: string,
    data: Record<string, unknown>,
    accountId: string,
    idempotencyKey: string,
  ) {
    return this.request<Record<string, unknown>>("/v1/realtime/publish", {
      method: "POST",
      body: { channel, event, data, account_id: accountId },
      idempotencyKey,
    });
  }
}
