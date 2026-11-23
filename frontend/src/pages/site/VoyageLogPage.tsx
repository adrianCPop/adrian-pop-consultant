import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Film,
  ImagePlus,
  KeyRound,
  Loader2,
  MapPin,
  Navigation,
  PauseCircle,
  Pencil,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import VoyageLanguageSwitch from "@/components/voyage/VoyageLanguageSwitch";
import { useCrewOnlyPage } from "@/lib/useCrewOnlyPage";
import { useVoyageTexts } from "@/lib/useVoyageTexts";
import {
  ApiError,
  deleteMyEntry,
  fetchMe,
  fetchMyEntries,
  MAX_VIDEO_BYTES,
  thumbUrl,
  type DevicePosition,
  type MyEntry,
  type PhotoQuality,
} from "@/lib/voyageApi";
import {
  addItem,
  listItems,
  newId,
  removeItem,
  storageIsDurable,
  syncOutbox,
  videoProgress,
  type NewPhoto,
  type OutboxItem,
} from "@/lib/voyageOutbox";
import { cn } from "@/lib/utils";

/**
 * The crew's page. There is no sign-in: each person opens their own secret link
 * once per device. Everything written here is kept on the device first and sent
 * when the boat has a connection.
 */

const KEY_STORE = "voyage-log-key";
const NAME_STORE = "voyage-log-name";
const GPS_STORE = "voyage-log-gps";
const QUALITY_STORE = "voyage-log-quality";

/** Low is for the satellite link; max is close to what the camera took. */
const PHOTO_SIZES: Record<PhotoQuality, { edge: number; jpeg: number }> = {
  low: { edge: 1600, jpeg: 0.8 },
  max: { edge: 3840, jpeg: 0.92 },
};
const POSTER_EDGE_PX = 1280;
const VIDEO_LIMIT = `${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB`;
const MAX_PHOTOS = 12;
/**
 * A browser position coarser than this comes from Wi-Fi or the network, not from
 * GPS, and can be where the boat's router used to be rather than where the boat is.
 */
const GPS_ACCURACY_M = 50;
const GPS_MAX_AGE_MS = 5 * 60_000;
const CHECK_EVERY_MS = 30_000;

/** A photo or a video of the entry being written. */
interface DraftPhoto {
  id: string;
  kind: "photo" | "video";
  /** Null for one the logbook already has (an entry being corrected). */
  blob: Blob | null;
  /** What to show for it; null for a video no picture could be taken from. */
  url: string | null;
  originalKb: number;
  compressedKb: number;
  quality?: PhotoQuality;
  video?: { w: number; h: number; duration: number };
  poster?: Blob | null;
}

interface GpsFix extends DevicePosition {
  at: number;
}

type LinkState = "checking" | "online" | "offline" | "revoked";

const KEY_RE = /[A-Za-z0-9_-]{40,}/;

/** Accepts the whole personal link or just the key at its end. */
const extractKey = (text: string): string | null => {
  const afterHash = text.includes("#") ? text.slice(text.indexOf("#") + 1) : text;
  const candidate = afterHash.replace(/^k=/, "").trim();
  return KEY_RE.exec(candidate)?.[0] ?? null;
};

const readStore = (name: string) => {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
};

const writeStore = (name: string, value: string | null) => {
  try {
    if (value === null) {
      window.localStorage.removeItem(name);
    } else {
      window.localStorage.setItem(name, value);
    }
  } catch {
    // Storage can be blocked in private windows; the link in the address bar still works.
  }
};

const shrinkPhoto = async (file: File, quality: PhotoQuality): Promise<DraftPhoto> => {
  const size = PHOTO_SIZES[quality];
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, size.edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", size.jpeg)
  );
  if (!blob) {
    throw new Error("Could not read this photo");
  }

  return {
    id: newId(),
    kind: "photo",
    blob,
    url: URL.createObjectURL(blob),
    originalKb: file.size / 1024,
    compressedKb: blob.size / 1024,
    quality,
  };
};

const isVideoFile = (file: File) =>
  file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm)$/i.test(file.name);

/**
 * A video goes as it is. Its size, its length and a picture to show before it
 * plays are read off the file where this browser can open it; where it cannot
 * (a format the phone records but this browser does not play), it still goes.
 */
const readVideo = async (file: File): Promise<DraftPhoto> => {
  const draft: DraftPhoto = {
    id: newId(),
    kind: "video",
    blob: file,
    url: null,
    originalKb: file.size / 1024,
    compressedKb: file.size / 1024,
    video: { w: 0, h: 0, duration: 0 },
    poster: null,
  };
  const address = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const until = (event: string, ms: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("slow")), ms);
        video.addEventListener(event, () => (window.clearTimeout(timer), resolve()), { once: true });
        video.addEventListener("error", () => (window.clearTimeout(timer), reject(new Error("unreadable"))), {
          once: true,
        });
      });
    const loaded = until("loadeddata", 8000);
    video.src = address;
    await loaded;
    draft.video = {
      w: video.videoWidth,
      h: video.videoHeight,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
    };
    // A moment in, where there is usually more to see than in the first frame.
    const seeked = until("seeked", 4000);
    video.currentTime = Math.min(1, draft.video.duration / 2);
    await seeked;
    const scale = Math.min(1, POSTER_EDGE_PX / Math.max(video.videoWidth, video.videoHeight, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8)
    );
    if (poster && canvas.width > 0) {
      draft.poster = poster;
      draft.url = URL.createObjectURL(poster);
    }
  } catch {
    // No picture, or no figures: the video is sent all the same.
  } finally {
    URL.revokeObjectURL(address);
  }
  return draft;
};

/** Let go of the pictures made for drafts. Those of the logbook's own photos are plain addresses. */
const releaseDrafts = (drafts: DraftPhoto[]) =>
  drafts.forEach((draft) => {
    if (draft.blob && draft.url) {
      URL.revokeObjectURL(draft.url);
    }
  });

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const VoyageLogPage = () => {
  const texts = useVoyageTexts();
  const { t } = texts;
  const [key, setKey] = useState<string | null>(
    () => extractKey(window.location.hash) ?? readStore(KEY_STORE)
  );
  const [name, setName] = useState<string | null>(() => readStore(NAME_STORE));
  const [link, setLink] = useState<LinkState>("checking");
  const [frozen, setFrozen] = useState(false);
  const [serverTrouble, setServerTrouble] = useState(false);
  const [pasted, setPasted] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [shrinking, setShrinking] = useState(false);

  const [quality, setQuality] = useState<PhotoQuality>(() =>
    readStore(QUALITY_STORE) === "max" ? "max" : "low"
  );
  /** The entry of the logbook being corrected, when the form holds one. */
  const [editing, setEditing] = useState<{ id: string; time: string } | null>(null);
  /** This person's entries as the server has them; null until it has answered. */
  const [mine, setMine] = useState<MyEntry[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** How far the videos of a waiting entry have got, by the entry's id. */
  const [progress, setProgress] = useState<Record<string, number>>({});

  const [items, setItems] = useState<OutboxItem[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [durable, setDurable] = useState(true);

  const [gpsOn, setGpsOn] = useState(() => readStore(GPS_STORE) === "on");
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [gpsProblem, setGpsProblem] = useState<"blocked" | "unavailable" | null>(null);
  const [, setGpsTick] = useState(0);

  useCrewOnlyPage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const photosRef = useRef<DraftPhoto[]>([]);
  photosRef.current = photos;

  const refreshItems = useCallback(async () => {
    const list = await listItems();
    setItems(list);
    const shares: Record<string, number> = {};
    for (const item of list) {
      const share = item.status === "waiting" ? await videoProgress(item.id) : null;
      if (share !== null) {
        shares[item.id] = share;
      }
    }
    setProgress(shares);
  }, []);

  const refreshMine = useCallback(async () => {
    if (!key) {
      return;
    }
    try {
      setMine((await fetchMyEntries(key)).entries);
    } catch {
      // No connection, or the link was refused: the list stays as it was.
    }
  }, [key]);

  /** The server refused this key: go back to the one this device already had, if it is another. */
  const keyRefused = useCallback(() => {
    const remembered = readStore(KEY_STORE);
    if (remembered && remembered !== key) {
      window.history.replaceState(null, "", window.location.pathname);
      setKey(remembered);
    } else {
      setLink("revoked");
    }
  }, [key]);

  /** Ask the server who this link belongs to, then send whatever is waiting. */
  const checkAndSend = useCallback(async () => {
    if (!key) {
      return;
    }
    try {
      const me = await fetchMe(key);
      // Only a key the server has accepted replaces what this device remembers.
      writeStore(KEY_STORE, key);
      setName(me.name);
      writeStore(NAME_STORE, me.name);
      setFrozen(me.frozen);
      setLink("online");
      if (me.frozen) {
        void refreshMine();
        return;
      }
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        keyRefused();
      } else {
        setLink("offline");
      }
      return;
    }

    const outcome = await syncOutbox(key, (id) => {
      setSendingId(id);
      void refreshItems();
    });
    if (outcome === "revoked") {
      keyRefused();
    } else if (outcome === "frozen") {
      setFrozen(true);
    } else if (outcome === "offline") {
      setLink("offline");
    } else if (outcome !== "busy") {
      setServerTrouble(outcome === "problems");
    }
    void refreshMine();
  }, [key, refreshItems, refreshMine, keyRefused]);

  // Remember the key on this device and keep checking for a connection.
  useEffect(() => {
    if (!key) {
      return;
    }
    // A first link is remembered straight away, as there is nothing to overwrite.
    // A different one replaces it only after the server has accepted it.
    if (!readStore(KEY_STORE)) {
      writeStore(KEY_STORE, key);
    }
    void navigator.storage?.persist?.();
    void checkAndSend();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkAndSend();
      }
    }, CHECK_EVERY_MS);
    const wake = () => document.visibilityState === "visible" && void checkAndSend();
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [key, checkAndSend]);

  // A new link opened in this same tab only changes the part after "#", which
  // does not reload the page: pick the key up from there.
  useEffect(() => {
    const onHashChange = () => {
      const found = extractKey(window.location.hash);
      if (found) {
        setLink("checking");
        setKey(found);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    void refreshItems();
    void storageIsDurable().then(setDurable);
    return () => releaseDrafts(photosRef.current);
  }, [refreshItems]);

  // Home-screen install: this page gets its own manifest, icon and offline copy.
  useEffect(() => {
    const added: HTMLElement[] = [];
    const add = (tag: string, attributes: Record<string, string>) => {
      const element = document.createElement(tag);
      Object.entries(attributes).forEach(([attribute, value]) => element.setAttribute(attribute, value));
      document.head.appendChild(element);
      added.push(element);
    };
    add("link", { rel: "manifest", href: "/voyage-log-manifest.json" });
    add("link", { rel: "apple-touch-icon", href: "/voyage-icon-180.png" });
    add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    add("meta", { name: "apple-mobile-web-app-title", content: "Ship's log" });

    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/voyage-sw.js", { scope: "/voyage/" })
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          // Hand the worker every file this page has loaded, so it opens with no connection.
          // The page's own script and stylesheet tags are listed too: they say which
          // build this page is, even in a browser that keeps no record of what it loaded.
          const tagged = Array.from(
            document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
              'script[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href]'
            ),
            (element) => (element instanceof HTMLScriptElement ? element.src : element.href)
          );
          const assets = [
            ...performance.getEntriesByType("resource").map((entry) => entry.name),
            ...tagged,
          ]
            .map((address) => new URL(address, window.location.href))
            .filter(
              (url) =>
                url.origin === window.location.origin &&
                !url.pathname.startsWith("/api/") &&
                /\.(js|css|png|json)$/.test(url.pathname)
            )
            .map((url) => url.pathname);
          registration.active?.postMessage({
            type: "precache",
            urls: ["/index.html", ...new Set(assets)],
          });
        })
        .catch(() => undefined);
    }

    return () => added.forEach((element) => element.remove());
  }, []);

  // GPS, only when asked for. Phones have it; laptops and many tablets do not.
  useEffect(() => {
    if (!gpsOn || !("geolocation" in navigator)) {
      setGps(null);
      return;
    }
    setGpsProblem(null);
    const watch = navigator.geolocation.watchPosition(
      (position) =>
        setGps({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          at: position.timestamp,
        }),
      (error) =>
        setGpsProblem(error.code === error.PERMISSION_DENIED ? "blocked" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 30_000 }
    );
    // Redraw now and then, so a position that has gone stale stops being offered.
    const tick = window.setInterval(() => setGpsTick((value) => value + 1), 30_000);
    return () => {
      navigator.geolocation.clearWatch(watch);
      window.clearInterval(tick);
    };
  }, [gpsOn]);

  const usableGps = (): DevicePosition | null => {
    if (!gps || gps.accuracy === null || gps.accuracy > GPS_ACCURACY_M) {
      return null;
    }
    if (Date.now() - gps.at > GPS_MAX_AGE_MS) {
      return null;
    }
    return { lat: gps.lat, lon: gps.lon, accuracy: Math.round(gps.accuracy) };
  };
  const goodGps = usableGps();

  const kb = (value: number) =>
    value >= 1024 ? `${texts.number(value / 1024, 1)} MB` : `${texts.number(value)} KB`;

  const toggleGps = (on: boolean) => {
    setGpsOn(on);
    writeStore(GPS_STORE, on ? "on" : null);
  };

  const openWithLink = (event: FormEvent) => {
    event.preventDefault();
    const found = extractKey(pasted);
    if (!found) {
      toast.error(t("log.link.notALink"));
      return;
    }
    setPasted("");
    if (found === key) {
      toast.error(t("log.link.sameLink"));
      return;
    }
    window.history.replaceState(null, "", `${window.location.pathname}#k=${found}`);
    setLink("checking");
    setKey(found);
  };

  const forgetLink = () => {
    writeStore(KEY_STORE, null);
    writeStore(NAME_STORE, null);
    window.history.replaceState(null, "", window.location.pathname);
    setKey(null);
    setName(null);
  };

  const pickPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setShrinking(true);
    const shrunk: DraftPhoto[] = [];
    for (const file of files) {
      if (isVideoFile(file)) {
        if (file.size > MAX_VIDEO_BYTES) {
          toast.error(t("log.videos.tooLarge", { file: file.name, size: VIDEO_LIMIT }));
        } else {
          shrunk.push(await readVideo(file));
        }
        continue;
      }
      try {
        shrunk.push(await shrinkPhoto(file, quality));
      } catch {
        toast.error(t("log.photos.unreadable", { file: file.name }));
      }
    }
    setPhotos((current) => [...current, ...shrunk]);
    setShrinking(false);
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      releaseDrafts(current.filter((photo) => photo.id === id));
      return current.filter((photo) => photo.id !== id);
    });
  };

  const chooseQuality = (value: PhotoQuality) => {
    setQuality(value);
    writeStore(QUALITY_STORE, value);
  };

  const clearForm = () => {
    releaseDrafts(photosRef.current);
    setTitle("");
    setBody("");
    setPhotos([]);
    setEditing(null);
  };

  /** Put one of the logbook's entries into the form, to correct it. */
  const startEdit = (entry: MyEntry) => {
    releaseDrafts(photosRef.current);
    setEditing({ id: entry.id, time: entry.time });
    setTitle(entry.title);
    setBody(entry.body);
    setPhotos(
      entry.photos.map((ref) => ({
        id: ref.id,
        kind: ref.kind === "video" ? "video" : "photo",
        blob: null,
        url: thumbUrl(ref),
        originalKb: 0,
        compressedKb: 0,
      }))
    );
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const deleteMine = async (entry: MyEntry) => {
    if (!key) {
      return;
    }
    const question = entry.title
      ? t("log.mine.deleteConfirm", { title: entry.title })
      : t("log.mine.deleteConfirmUntitled");
    if (!window.confirm(question)) {
      return;
    }
    setDeletingId(entry.id);
    try {
      await deleteMyEntry(key, entry.id);
      // The device's own record of it goes too, so it is not sent again.
      await removeItem(entry.id);
      if (editing?.id === entry.id) {
        clearForm();
      }
      toast.success(t("log.mine.deleted"));
    } catch (error) {
      toast.error(
        error instanceof ApiError ? texts.server(error.message) : t("log.mine.notDeleted")
      );
    }
    setDeletingId(null);
    await refreshItems();
    await refreshMine();
  };

  const saveEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() && !body.trim() && photos.length === 0) {
      toast.error(t("log.entry.empty"));
      return;
    }

    // Only what the logbook does not have yet is kept on the device to be sent.
    const records: NewPhoto[] = [];
    for (const photo of photos) {
      if (!photo.blob) {
        continue;
      }
      if (photo.kind === "video") {
        const posterId = photo.poster ? newId() : null;
        if (photo.poster && posterId) {
          records.push({ id: posterId, blob: photo.poster, poster: true });
        }
        records.push({
          id: photo.id,
          blob: photo.blob,
          video: { ...(photo.video ?? { w: 0, h: 0, duration: 0 }), posterId },
        });
      } else {
        records.push({ id: photo.id, blob: photo.blob, quality: photo.quality });
      }
    }

    try {
      if (editing) {
        // An earlier record of this entry on the device is replaced, not added to.
        await removeItem(editing.id);
      }
      await addItem(
        {
          id: editing?.id ?? newId(),
          kind: "entry",
          // A correction keeps the time the entry was written, and its position.
          createdAt: editing?.time ?? new Date().toISOString(),
          title: title.trim(),
          body: body.trim(),
          position: editing ? null : usableGps(),
          photoIds: photos.map((photo) => photo.id),
          status: "waiting",
          ...(editing ? { edit: true } : {}),
        },
        records
      );
    } catch {
      toast.error(t("log.entry.notSaved"));
      return;
    }

    const corrected = editing !== null;
    clearForm();
    await refreshItems();
    toast.success(t(corrected ? "log.edit.saved" : "log.entry.saved"), {
      description: t("log.entry.savedDetail"),
    });
    void checkAndSend();
  };

  const sendPositionOnly = async () => {
    const position = usableGps();
    if (!position) {
      toast.error(t("log.position.none"));
      return;
    }
    await addItem(
      {
        id: newId(),
        kind: "position",
        createdAt: new Date().toISOString(),
        title: "",
        body: "",
        position,
        photoIds: [],
        status: "waiting",
      },
      []
    );
    await refreshItems();
    toast.success(t("log.position.saved"));
    void checkAndSend();
  };

  const discard = async (item: OutboxItem) => {
    if (!window.confirm(t("log.outbox.discardConfirm"))) {
      return;
    }
    await removeItem(item.id);
    await refreshItems();
  };

  // ------------------------------------------------------------- no link yet

  if (!key || link === "revoked") {
    const waiting = items.filter((item) => item.status === "waiting").length;

    return (
      <div lang={texts.htmlLang} className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
        <div className="flex items-start justify-between gap-4">
          <p className="pt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {t("log.crewOnly")}
          </p>
          <VoyageLanguageSwitch />
        </div>
        <h1 className="mt-2 font-heading text-3xl font-semibold">{t("log.title")}</h1>

        <form onSubmit={openWithLink} className="panel-soft mt-6 rounded-2xl p-5">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-base font-semibold text-foreground">
              {link === "revoked" && key ? t("log.link.off") : t("log.link.open")}
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {link === "revoked" && key ? t("log.link.askNew") : t("log.link.explain")}
          </p>
          {waiting > 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {t("log.link.unsent", { count: waiting })}
            </p>
          ) : null}
          <Label htmlFor="personal-link" className="sr-only">
            {t("log.link.field")}
          </Label>
          <Input
            id="personal-link"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={t("log.link.paste")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="mt-4 h-11 rounded-xl border-border/80 bg-secondary/50"
          />
          <Button type="submit" className="mt-3 h-11 w-full rounded-xl text-sm font-semibold">
            {t("log.link.submit")}
          </Button>
        </form>
      </div>
    );
  }

  // ------------------------------------------------------------- the log

  const waitingItems = items.filter((item) => item.status === "waiting");
  const shownItems = [...items].reverse();
  const online = link === "online";

  let connectionTitle = t("log.connection.checking");
  let connectionDetail = t("log.connection.moment");
  if (frozen) {
    connectionTitle = t("log.connection.paused");
    connectionDetail = t("log.connection.pausedDetail");
  } else if (online) {
    connectionTitle = sendingId ? t("log.connection.sending") : t("log.connection.connected");
    connectionDetail = serverTrouble
      ? t("log.connection.trouble")
      : waitingItems.length > 0
        ? t("log.connection.waiting", { count: waitingItems.length })
        : t("log.connection.allSent");
  } else if (link === "offline") {
    connectionTitle = t("log.connection.none");
    connectionDetail =
      waitingItems.length > 0
        ? t("log.connection.waitingOffline", { count: waitingItems.length })
        : t("log.connection.keepWriting");
  }

  return (
    <div lang={texts.htmlLang} className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {t("log.crewOnly")}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold">{t("log.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {name ? t("log.writingAs", { name }) : t("log.nameComes")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <VoyageLanguageSwitch />
          <button
            type="button"
            onClick={forgetLink}
            className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {name ? t("log.notYou", { name }) : t("log.notYouUnnamed")}
          </button>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_1fr] lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="space-y-4 lg:col-start-2 lg:row-start-1">
          <section className="panel-soft rounded-2xl p-5" aria-live="polite">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                  frozen
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    : online
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-border/70 bg-secondary/60 text-muted-foreground"
                )}
              >
                {frozen ? (
                  <PauseCircle className="h-4 w-4" />
                ) : sendingId || link === "checking" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : online ? (
                  <Wifi className="h-4 w-4" />
                ) : (
                  <WifiOff className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{connectionTitle}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{connectionDetail}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 rounded-lg"
                onClick={() => void checkAndSend()}
                disabled={sendingId !== null}
              >
                {t("log.connection.tryNow")}
              </Button>
            </div>
          </section>

          {!durable ? (
            <p className="flex items-start gap-2.5 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-xs leading-relaxed text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t("log.notDurable")}
            </p>
          ) : null}

        </div>

        <form
          ref={formRef}
          onSubmit={saveEntry}
          className={cn(
            "panel-soft scroll-mt-4 rounded-2xl p-5 sm:p-6 lg:col-start-1 lg:row-span-2 lg:row-start-1",
            editing && "ring-1 ring-primary/70"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {t(editing ? "log.edit.title" : "log.entry.new")}
            </h2>
            {editing ? (
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={clearForm}>
                {t("log.edit.cancel")}
              </Button>
            ) : null}
          </div>
          {editing ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("log.edit.note", { time: texts.stamp(editing.time) })}
            </p>
          ) : null}

          <div className="mt-4 rounded-xl border border-border/70 bg-secondary/40 p-3">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                {goodGps ? (
                  <>
                    <p className="font-heading text-sm font-semibold tabular-nums text-foreground">
                      {texts.coord([goodGps.lat, goodGps.lon])}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("log.gps.accurate", { accuracy: goodGps.accuracy })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      {t("log.gps.fromTrack")}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {gpsProblem
                        ? t(gpsProblem === "blocked" ? "log.gps.blocked" : "log.gps.unavailable")
                        : gpsOn
                          ? gps
                            ? t("log.gps.rough")
                            : t("log.gps.looking")
                          : t("log.gps.off")}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <Label htmlFor="use-gps" className="text-xs font-medium text-muted-foreground">
                {t("log.gps.use")}
              </Label>
              <Switch id="use-gps" checked={gpsOn} onCheckedChange={toggleGps} />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="log-title" className="text-xs font-semibold uppercase tracking-[0.1em]">
              {t("log.entry.title")}
            </Label>
            <Input
              id="log-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder={t("log.entry.titleExample")}
              className="h-11 rounded-xl border-border/80 bg-secondary/50"
            />
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="log-body" className="text-xs font-semibold uppercase tracking-[0.1em]">
              {t("log.entry.body")}
            </Label>
            <Textarea
              id="log-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={8000}
              rows={6}
              placeholder={t("log.entry.bodyExample")}
              className="rounded-xl border-border/80 bg-secondary/50"
            />
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em]">{t("log.photos.title")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span id="photo-quality" className="text-xs font-medium text-muted-foreground">
                {t("log.quality.title")}
              </span>
              <div
                role="group"
                aria-labelledby="photo-quality"
                className="inline-flex items-center rounded-lg border border-border/80 bg-secondary/40 p-0.5"
              >
                {(["low", "max"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={quality === value}
                    onClick={() => chooseQuality(value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      quality === value
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(value === "max" ? "log.quality.max" : "log.quality.low")}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t(quality === "max" ? "log.quality.maxNote" : "log.photos.note")}{" "}
              {t("log.videos.note", { size: VIDEO_LIMIT })}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-secondary/60"
                >
                  {photo.url ? (
                    <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Film className="h-7 w-7" />
                    </span>
                  )}
                  {photo.kind === "video" ? (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white">
                      <Film className="h-3 w-3" />
                      {t("log.videos.badge")}
                    </span>
                  ) : null}
                  {photo.blob ? (
                    <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1 text-center text-[0.62rem] tabular-nums text-white">
                      {photo.kind === "video"
                        ? kb(photo.originalKb)
                        : `${kb(photo.originalKb)} → ${kb(photo.compressedKb)}`}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    aria-label={t("log.photos.remove")}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={shrinking}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  {shrinking ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  {shrinking ? t("log.photos.shrinking") : t("log.photos.add")}
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={(event) => void pickPhotos(event)}
              tabIndex={-1}
              aria-label={t("log.photos.addLabel")}
            />
          </div>

          <Button
            type="submit"
            disabled={shrinking}
            className="mt-6 h-12 w-full rounded-xl text-sm font-semibold"
          >
            {t(editing ? "log.edit.save" : "log.entry.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void sendPositionOnly()}
            disabled={!goodGps || editing !== null}
            className="mt-3 h-11 w-full rounded-xl text-sm font-semibold"
          >
            <Navigation className="mr-2 h-4 w-4" />
            {t("log.position.send")}
          </Button>
          {!goodGps ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {t("log.position.needsGps")}
            </p>
          ) : null}
        </form>

        <div className="space-y-4 lg:col-start-2 lg:row-start-2">
          <section className="panel-soft rounded-2xl p-5">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {t("log.outbox.title")}
            </h2>
            {shownItems.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("log.outbox.empty")}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {shownItems.map((item) => {
                  const sending = sendingId === item.id;

                  return (
                    <li key={item.id} className="flex items-start gap-3 py-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          item.status === "sent" && "bg-emerald-400/15 text-emerald-300",
                          item.status === "waiting" && "bg-secondary text-muted-foreground",
                          item.status === "failed" && "bg-red-400/15 text-red-300"
                        )}
                      >
                        {sending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : item.status === "sent" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : item.status === "failed" ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.kind === "position"
                            ? t("log.outbox.positionOnly")
                            : item.title || item.body.slice(0, 60) || t("log.outbox.photosOnly")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {texts.localStamp(item.createdAt)}
                          {item.photoIds.length > 0
                            ? ` · ${t("common.photos", { count: item.photoIds.length })}`
                            : ""}
                          {" · "}
                          {item.edit ? `${t("log.outbox.correction")} · ` : ""}
                          {sending
                            ? progress[item.id] !== undefined
                              ? t("log.outbox.videoProgress", {
                                  percent: Math.round(progress[item.id] * 100),
                                })
                              : t("log.outbox.sending")
                            : item.status === "sent"
                              ? t("log.outbox.sent")
                              : item.status === "failed"
                                ? t("log.outbox.failed")
                                : t("log.outbox.waiting")}
                        </p>
                        {item.error ? (
                          <p className="mt-0.5 text-xs text-red-300">{texts.outboxError(item.error)}</p>
                        ) : null}
                      </div>
                      {item.status !== "sent" && !sending ? (
                        <button
                          type="button"
                          onClick={() => void discard(item)}
                          aria-label={t("log.outbox.discard")}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel-soft rounded-2xl p-5">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {t("log.mine.title")}
            </h2>
            {mine === null ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("log.mine.offline")}</p>
            ) : mine.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("log.mine.empty")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {mine.map((entry) => {
                  const pending = items.some(
                    (item) => item.id === entry.id && item.status === "waiting"
                  );
                  const busy = deletingId === entry.id;

                  return (
                    <li key={entry.id} className="flex items-start gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {entry.title || entry.body.slice(0, 60) || t("log.outbox.photosOnly")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {texts.stamp(entry.time)}
                          {entry.photos.length > 0
                            ? ` · ${t("common.photos", { count: entry.photos.length })}`
                            : ""}
                        </p>
                        {pending ? (
                          <p className="mt-0.5 text-xs text-primary">{t("log.mine.waiting")}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        disabled={pending || busy || frozen}
                        aria-label={`${t("log.mine.edit")}: ${entry.title || t("common.logEntry")}`}
                        title={t("log.mine.edit")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteMine(entry)}
                        disabled={pending || busy || frozen}
                        aria-label={`${t("log.mine.delete")}: ${entry.title || t("common.logEntry")}`}
                        title={t("log.mine.delete")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {!isStandalone() ? (
            <section className="panel-soft rounded-2xl p-5">
              <div className="flex items-center gap-2.5">
                <Smartphone className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-base font-semibold text-foreground">
                  {t("log.install.title")}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("log.install.body")}
              </p>
            </section>
          ) : null}
        </div>

      </div>
    </div>
  );
};

export default VoyageLogPage;
