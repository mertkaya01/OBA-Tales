/**
 * Yönetim API'sine istek (scripts/yonetimPlugin.ts). Yazan istekler JSON ve "X-Yonetim: 1" başlığıyla gider; sunucu
 * başka sitelerden gelen istekleri reddeder.
 */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/__yonetim${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json", "X-Yonetim": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Hata ${response.status}`);
  return data;
}
