const apiBaseUrl = (import.meta.env.VITE_SCHEDULE_API_BASE_URL ?? "/api").replace(/\/$/, "");
const defaultRequestTimeoutMs = 20_000;

/** APIがHTTPエラーを返したことを表す、画面で判定可能なエラーです。 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** 認証ヘッダーなどを受け取り、共通のAPI JSON通信を実行します。 */
export async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? defaultRequestTimeoutMs,
  );
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      signal: init?.signal ?? controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ApiRequestError(
        body || `${response.status} ${response.statusText}`,
        response.status,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError("APIへの接続がタイムアウトしました。再試行してください。", 408);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
