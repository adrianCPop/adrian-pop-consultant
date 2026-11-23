/** Client for the voyage tracker API (backend/routes/voyage.py). */
import type { LatLon } from "@/lib/geo";
import { isSeaForecast, type SeaForecast, type SeaLayerName } from "@/lib/seaField";

export interface VoyagePort {
  name: string;
  /** The name on the Romanian page. Empty or missing: the same as `name`. */
  name_ro?: string;
  lat: number;
  lon: number;
}

export interface VoyageSettings {
  eyebrow: string;
  /** The small heading on the Romanian page. Empty or missing: the same as `eyebrow`. */
  eyebrow_ro?: string;
  boat_name: string;
  origin: VoyagePort;
  destination: VoyagePort;
  departure: string | null;
  arrived_at: string | null;
  planned_route: LatLon[];
}

/** A photo of an entry, or a video when `kind` says so. */
export interface VoyagePhotoRef {
  id: string;
  w: number;
  h: number;
  kind?: "video";
  /** A photo that was sent at full quality: a larger version can be opened. */
  max?: boolean;
  /** A video's length in seconds, and the photo shown before it plays. */
  dur?: number;
  poster?: string | null;
}

export type PhotoQuality = "low" | "max";

/** The languages a saved log entry is translated into. */
export type LogLanguage = "en" | "ro" | "de" | "da";

export interface VoyageEntry {
  translation?: {
    source: string;
    versions: Partial<Record<LogLanguage, { title: string; body: string }>>;
  } | null;
  id: string;
  time: string;
  /** Null when the entry was written ashore or the track has a gap around it. */
  pos: LatLon | null;
  title: string;
  body: string;
  author: string;
  photos: VoyagePhotoRef[];
}

export interface VoyageWeather {
  time: string | null;
  wind_kn: number | null;
  wind_dir_deg: number | null;
  gust_kn: number | null;
  air_c: number | null;
  wave_m: number | null;
  wave_dir_deg: number | null;
  wave_period_s: number | null;
  sea_c: number | null;
}

export type VoyageStatus = "not_configured" | "planned" | "under_way" | "arrived";

export interface VoyageData {
  server_time: string;
  status: VoyageStatus;
  voyage: VoyageSettings | null;
  /** [lat, lon, epoch seconds], oldest first. */
  track: [number, number, number][];
  entries: VoyageEntry[];
  weather: VoyageWeather | null;
  /** Whether there are forecasts to lay over the map (waves, wind). */
  sea?: boolean;
}

export interface CrewIdentity {
  name: string;
  kind: "crew" | "tracker";
  frozen: boolean;
}

export interface DevicePosition {
  lat: number;
  lon: number;
  accuracy: number | null;
}

export interface EntryPayload {
  id: string;
  written_at: string;
  title: string;
  body: string;
  position: DevicePosition | null;
  photo_ids: string[];
}

export interface AdminKey {
  id: string;
  name: string;
  kind: "crew" | "tracker";
  created_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface AdminState {
  server_time: string;
  settings: VoyageSettings | null;
  frozen: boolean;
  keys: AdminKey[];
  entries: { id: string; time: string; title: string; author: string; photo_count: number }[];
  positions: {
    total: number;
    public_total: number;
    last: { id: string; time: string; lat: number; lon: number; src: string; by: string }[];
  };
  photos: { count: number };
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** True when the request never got an answer: no connection, or it timed out. */
export const isOffline = (error: unknown) => !(error instanceof ApiError);

const BASE = "/api/voyage";

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const detail = (body as { detail?: unknown } | null)?.detail;
      throw new ApiError(
        response.status,
        typeof detail === "string" ? detail : `The server answered ${response.status}`,
        body
      );
    }
    return body as T;
  } finally {
    window.clearTimeout(timer);
  }
}

const json = (method: string, body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

const bearer = (secret: string) => ({ Authorization: `Bearer ${secret}` });

export const photoUrl = (id: string, size: "thumb" | "full" | "max" = "full") =>
  `${BASE}/photos/${id}${size === "full" ? "" : `?size=${size}`}`;

export const videoUrl = (id: string) => `${BASE}/videos/${id}`;

/** The small picture that stands for a photo or a video; null for a video without one. */
export const thumbUrl = (ref: VoyagePhotoRef) =>
  ref.kind === "video" ? (ref.poster ? photoUrl(ref.poster, "thumb") : null) : photoUrl(ref.id, "thumb");

/** A video goes up in parts of this size, so a dropped connection costs only one. */
export const VIDEO_PART_BYTES = 2 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

// ---- public

export const fetchVoyage = () => request<VoyageData>("");

/**
 * Waves or wind over the ocean around the planned route, for the map's overlay.
 * When the server answers 503 with `retry_in` in the body, the forecast is on
 * its way and worth asking for again after that many seconds.
 */
export const fetchSea = async (layer: SeaLayerName): Promise<SeaForecast> => {
  const forecast = await request<unknown>(`/sea?layer=${layer}`, {}, 30_000);
  // A 200 is not always the server's: a harbour Wi-Fi's sign-in page answers 200 too.
  if (!isSeaForecast(forecast) || forecast.layer !== layer) {
    throw new ApiError(502, "The server answered 502");
  }
  return forecast;
};

// ---- crew (secret link)

export const fetchMe = (key: string) =>
  request<CrewIdentity>("/me", { headers: bearer(key) }, 10_000);

export const sendEntry = (key: string, entry: EntryPayload) =>
  request<{ ok: true; id: string }>("/entries", json("POST", entry, bearer(key)));

/** One of this person's own entries, as the server has it. */
export interface MyEntry {
  id: string;
  time: string;
  title: string;
  body: string;
  photos: VoyagePhotoRef[];
}

export const fetchMyEntries = (key: string) =>
  request<{ entries: MyEntry[] }>("/entries/mine", { headers: bearer(key) });

export const deleteMyEntry = (key: string, id: string) =>
  request<{ ok: true }>(`/entries/${id}`, { method: "DELETE", headers: bearer(key) });

export const uploadVideoPart = (key: string, id: string, part: number, blob: Blob) =>
  request<{ ok: true; complete: boolean }>(
    `/videos/${id}/parts/${part}`,
    { method: "PUT", headers: { "Content-Type": "application/octet-stream", ...bearer(key) }, body: blob },
    180_000
  );

export const finishVideo = (
  key: string,
  id: string,
  done: { parts: number; w: number; h: number; duration: number; poster_id: string | null }
) => request<VoyagePhotoRef>(`/videos/${id}/finish`, json("POST", done, bearer(key)), 60_000);

export const uploadPhoto = (key: string, id: string, blob: Blob, quality: PhotoQuality = "low") =>
  request<VoyagePhotoRef>(
    `/photos/${id}${quality === "max" ? "?quality=max" : ""}`,
    { method: "PUT", headers: { "Content-Type": blob.type || "image/jpeg", ...bearer(key) }, body: blob },
    180_000
  );

export const sendPosition = (key: string, position: DevicePosition, time: string) =>
  request<{ ok: true; stored: boolean; reason: string }>(
    "/positions",
    json("POST", { lat: position.lat, lon: position.lon, accuracy: position.accuracy, t: time }, bearer(key))
  );

// ---- admin (password)

export const adminLogin = (password: string) =>
  request<{ token: string; expires_at: string }>("/admin/login", json("POST", { password }));

export const adminLogout = (token: string) =>
  request<{ ok: true }>("/admin/logout", { method: "POST", headers: bearer(token) });

export const fetchAdminState = (token: string) =>
  request<AdminState>("/admin/state", { headers: bearer(token) });

export const saveSettings = (token: string, settings: VoyageSettings) =>
  request<{ ok: true }>("/admin/settings", json("PUT", settings, bearer(token)));

export const createKey = (token: string, name: string, kind: "crew" | "tracker") =>
  request<{ id: string; name: string; kind: string; key: string }>(
    "/admin/keys",
    json("POST", { name, kind }, bearer(token))
  );

export const revokeKey = (token: string, id: string) =>
  request<{ ok: true }>(`/admin/keys/${id}/revoke`, { method: "POST", headers: bearer(token) });

export const setFrozen = (token: string, frozen: boolean) =>
  request<{ ok: true; frozen: boolean }>("/admin/freeze", json("POST", { frozen }, bearer(token)));

export const deleteEntry = (token: string, id: string) =>
  request<{ ok: true }>(`/admin/entries/${id}`, { method: "DELETE", headers: bearer(token) });

export const deletePosition = (token: string, id: string) =>
  request<{ ok: true }>(`/admin/positions/${id}`, { method: "DELETE", headers: bearer(token) });

export const deletePositionsInPeriod = (token: string, start: string, end: string) =>
  request<{ ok: true; deleted: number }>(
    "/admin/positions/delete-period",
    json("POST", { start, end }, bearer(token))
  );
