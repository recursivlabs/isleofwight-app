type PublicTrpcResponse<T> = {
  result?: { data?: T };
  error?: { json?: { message?: string }; message?: string };
};

/** A failed public tRPC read with enough transport context for callers to react safely. */
export class PublicTrpcError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PublicTrpcError';
    this.status = status;
  }
}

/** Shared keyless transport for procedures the platform explicitly exposes publicly. */
export class PublicTrpcClient {
  private readonly apiOrigin: string;
  private readonly timeout: number;

  constructor(baseUrl: string, timeout = 30_000) {
    this.apiOrigin = baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    this.timeout = timeout;
  }

  async query<T>(procedure: string, input: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.apiOrigin}/api/trpc/${procedure}`);
    url.searchParams.set('input', JSON.stringify(input));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const body = (await response.json()) as PublicTrpcResponse<T>;
      const data = body.result?.data;
      if (!response.ok || data === undefined) {
        const message = body.error?.json?.message
          || body.error?.message
          || `Public request failed (${response.status})`;
        throw new PublicTrpcError(response.status, message);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
}
