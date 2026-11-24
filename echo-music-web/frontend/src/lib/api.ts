export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  thumbnail?: string | null;
  duration?: number | null;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}
