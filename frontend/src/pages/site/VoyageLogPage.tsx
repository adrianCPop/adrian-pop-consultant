import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  ImagePlus,
  KeyRound,
  Loader2,
  MapPin,
  Navigation,
  PauseCircle,
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
import { CREW_LANGUAGES } from "@/lib/voyageI18n";
import { useCrewOnlyPage } from "@/lib/useCrewOnlyPage";
import { useVoyageTexts } from "@/lib/useVoyageTexts";
import { ApiError, fetchMe, type DevicePosition } from "@/lib/voyageApi";
import {
  addItem,
  listItems,
  newId,
  removeItem,
  storageIsDurable,
  syncOutbox,
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

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;
const MAX_PHOTOS = 12;
/**
 * A browser position coarser than this comes from Wi-Fi or the network, not from
 * GPS, and can be where the boat's router used to be rather than where the boat is.
 */
const GPS_ACCURACY_M = 50;
const GPS_MAX_AGE_MS = 5 * 60_000;
const CHECK_EVERY_MS = 30_000;

interface DraftPhoto {
  id: string;
  blob: Blob;
  url: string;
  originalKb: number;
  compressedKb: number;
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

const shrinkPhoto = async (file: File): Promise<DraftPhoto> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) {
    throw new Error("Could not read this photo");
  }

  return {
    id: newId(),
    blob,
    url: URL.createObjectURL(blob),
    originalKb: file.size / 1024,
    compressedKb: blob.size / 1024,
  };
};

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

  const [items, setItems] = useState<OutboxItem[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [durable, setDurable] = useState(true);

  const [gpsOn, setGpsOn] = useState(() => readStore(GPS_STORE) === "on");
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [gpsProblem, setGpsProblem] = useState<"blocked" | "unavailable" | null>(null);
  const [, setGpsTick] = useState(0);

  useCrewOnlyPage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<DraftPhoto[]>([]);
  photosRef.current = photos;

  const refreshItems = useCallback(async () => {
    setItems(await listItems());
  }, []);

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
  }, [key, refreshItems, keyRefused]);

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
    return () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
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
      try {
        shrunk.push(await shrinkPhoto(file));
      } catch {
        toast.error(t("log.photos.unreadable", { file: file.name }));
      }
    }
    setPhotos((current) => [...current, ...shrunk]);
    setShrinking(false);
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      current.filter((photo) => photo.id === id).forEach((photo) => URL.revokeObjectURL(photo.url));
      return current.filter((photo) => photo.id !== id);
    });
  };

  const saveEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() && !body.trim() && photos.length === 0) {
      toast.error(t("log.entry.empty"));
      return;
    }

    try {
      await addItem(
        {
          id: newId(),
          kind: "entry",
          createdAt: new Date().toISOString(),
          title: title.trim(),
          body: body.trim(),
          position: usableGps(),
          photoIds: photos.map((photo) => photo.id),
          status: "waiting",
        },
        photos.map((photo) => ({ id: photo.id, blob: photo.blob }))
      );
    } catch {
      toast.error(t("log.entry.notSaved"));
      return;
    }

    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setTitle("");
    setBody("");
    setPhotos([]);
    await refreshItems();
    toast.success(t("log.entry.saved"), { description: t("log.entry.savedDetail") });
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
          <VoyageLanguageSwitch languages={CREW_LANGUAGES} />
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
          <VoyageLanguageSwitch languages={CREW_LANGUAGES} />
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

        <form onSubmit={saveEntry} className="panel-soft rounded-2xl p-5 sm:p-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {t("log.entry.new")}
          </h2>

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
            <p className="mt-1 text-xs text-muted-foreground">
              {t("log.photos.note")}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-xl border border-border/70"
                >
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1 text-center text-[0.62rem] tabular-nums text-white">
                    {kb(photo.originalKb)} → {kb(photo.compressedKb)}
                  </span>
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
              accept="image/*"
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
            {t("log.entry.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void sendPositionOnly()}
            disabled={!goodGps}
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
                          {sending
                            ? t("log.outbox.sending")
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
