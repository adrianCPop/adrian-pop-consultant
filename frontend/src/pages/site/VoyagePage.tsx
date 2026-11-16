import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  CalendarClock,
  Camera,
  Gauge,
  LifeBuoy,
  Loader2,
  MapPin,
  Maximize2,
  Sailboat,
  Thermometer,
  Timer,
  Trophy,
  Waves,
  Wind,
  X,
} from "lucide-react";
import VoyageMap, { type MapView, type VoyageMapPin } from "@/components/voyage/VoyageMap";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { compassPoint, distanceNm, formatCoord, type LatLon } from "@/lib/geo";
import { fetchVoyage, photoUrl, type VoyageData, type VoyageEntry, type VoyagePhotoRef } from "@/lib/voyageApi";
import { computeStats, toFixes } from "@/lib/voyageStats";
import { cn } from "@/lib/utils";

const REFRESH_MS = 5 * 60_000;
const DAY_MS = 86_400_000;
/** Past this long without a position, the status dot turns amber. */
const QUIET_MS = 24 * 3_600_000;
/** Within this distance of the boat, the newest entry opens from the boat marker instead of its own pin. */
const NEAR_BOAT_NM = 60;

const formatUtc = (time: number | string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(new Date(time));

const dayMonth = (time: number | string) => formatUtc(time, { day: "numeric", month: "short" });
const fullDate = (time: number | string) =>
  formatUtc(time, { day: "numeric", month: "long", year: "numeric" });
const clock = (time: number | string) =>
  `${formatUtc(time, { hour: "2-digit", minute: "2-digit" })} UTC`;
const nm = (value: number) => Math.round(value).toLocaleString("en-US");

const formatSpan = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  return `${Math.floor(hours / 24)} days`;
};

const formatDuration = (hours: number) => {
  const days = Math.floor(hours / 24);
  const rest = Math.floor(hours - days * 24);
  return rest === 0 ? `${days} d` : `${days} d ${rest} h`;
};

const one = (value: number | null, unit: string) =>
  value === null ? "No data" : `${value.toFixed(1)} ${unit}`;

interface StatTileProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}

const StatTile = ({ icon, label, value, hint }: StatTileProps) => (
  <div className="panel-soft rounded-2xl p-5">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
    <p className="mt-3 font-heading text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </div>
);

interface ConditionRowProps {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}

const ConditionRow = ({ icon, label, value, detail }: ConditionRowProps) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/60 text-primary">
      {icon}
    </span>
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="font-heading text-base font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  </div>
);

interface Loaded {
  data: VoyageData;
  /** Difference between the server's clock and this device's, in ms. */
  clockOffset: number;
}

const VoyagePage = () => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  const [fitNonce, setFitNonce] = useState(0);
  const [lightbox, setLightbox] = useState<{ photo: VoyagePhotoRef; entry: VoyageEntry } | null>(
    null
  );
  /** The entry opened over the page from the map, and which of its photos is shown large. */
  const [opened, setOpened] = useState<{ id: string; photo: number } | null>(null);
  /** Set when the overlay is closed in order to go to the entry in the logbook. */
  const goToAfterCloseRef = useRef<string | null>(null);
  /** What had the keyboard focus when the overlay opened (the pin, usually), to hand it back. */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  /** The entry last opened, to find its pin again if the map was redrawn meanwhile. */
  const lastOpenedIdRef = useRef<string | null>(null);
  const openedAtRef = useRef(0);
  /** What the overlay displays; see where it is filled in. */
  const shownRef = useRef<{ entry: VoyageEntry; photo: VoyagePhotoRef | null } | null>(null);
  const overlayScrollerRef = useRef<HTMLDivElement>(null);
  const mapSectionRef = useRef<HTMLElement>(null);
  const mapViewRef = useRef<MapView | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchVoyage();
      setLoaded({ data, clockOffset: Date.parse(data.server_time) - Date.now() });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, REFRESH_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const data = loaded?.data ?? null;
  const voyage = data?.voyage ?? null;
  const serverNow = now + (loaded?.clockOffset ?? 0);

  const fixes = useMemo(() => toFixes(data?.track ?? []), [data]);
  const trackLine = useMemo<LatLon[]>(() => fixes.map((fix) => fix.pos), [fixes]);
  const entries = useMemo(() => data?.entries ?? [], [data]);

  const departure = voyage?.departure ? Date.parse(voyage.departure) : null;
  const arrival = voyage?.arrived_at ? Date.parse(voyage.arrived_at) : null;
  const status = data?.status ?? "not_configured";
  const destination: LatLon | null = voyage ? [voyage.destination.lat, voyage.destination.lon] : null;

  const stats = useMemo(() => {
    if (departure === null || destination === null || status === "planned") {
      return null;
    }
    const until = status === "arrived" && arrival !== null ? arrival : serverNow;
    return computeStats(fixes, departure, destination, until);
    // `serverNow` moves every minute; the figures only need to follow the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixes, departure, arrival, status, voyage]);

  const entryNumbers = useMemo(
    () => new Map(entries.map((entry, index) => [entry.id, index + 1])),
    [entries]
  );
  const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const boatEntryId =
    stats && latestEntry?.pos && distanceNm(latestEntry.pos, stats.position) < NEAR_BOAT_NM
      ? latestEntry.id
      : undefined;

  const pins = useMemo<VoyageMapPin[]>(
    () =>
      entries
        .filter((entry) => entry.pos !== null && entry.id !== boatEntryId)
        .map((entry) => ({
          id: entry.id,
          label: String(entryNumbers.get(entry.id)),
          title: entry.title || "Log entry",
          pos: entry.pos as LatLon,
        })),
    [entries, entryNumbers, boatEntryId]
  );

  const entriesNewestFirst = useMemo(() => [...entries].reverse(), [entries]);
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  // Looked up on every render, so the overlay closes by itself if the entry is deleted.
  const openedEntry = opened ? entries.find((entry) => entry.id === opened.id) ?? null : null;
  const openedPhoto = openedEntry
    ? openedEntry.photos[Math.min(opened?.photo ?? 0, openedEntry.photos.length - 1)] ?? null
    : null;
  // Kept after the overlay is told to close, so it fades out with its content
  // rather than as an empty frame.
  if (openedEntry) {
    shownRef.current = { entry: openedEntry, photo: openedPhoto };
  }
  const shown = shownRef.current;

  useEffect(() => {
    // The entry was deleted while it was open. Forget it, so that it does not open
    // again by itself if an entry with the same id is ever sent again.
    if (opened && !openedEntry) {
      setOpened(null);
    }
  }, [opened, openedEntry]);

  const dayLabel = (entry: VoyageEntry) => {
    const time = Date.parse(entry.time);
    if (departure === null || time < departure) {
      return "Before departure";
    }
    if (arrival !== null && time > arrival) {
      return "After landfall";
    }
    return `Day ${Math.floor((time - departure) / DAY_MS) + 1}`;
  };

  const showOnMap = (id: string) => {
    setSelectedId(id);
    setFocus({ id, nonce: Date.now() });
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const readEntry = (id: string) => {
    const article = document.getElementById(`entry-${id}`);
    // Focus goes along, so a keyboard or screen-reader user carries on from the entry.
    article?.focus({ preventScroll: true });
    article?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /** A pin or the boat was clicked on the map: mark it and open the entry over the page. */
  const openEntry = (id: string) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lastOpenedIdRef.current = id;
    openedAtRef.current = Date.now();
    setSelectedId(id);
    setOpened({ id, photo: 0 });
  };

  /** Where focus goes when the overlay closes: back to what opened it, if that is still there. */
  const focusAfterOverlay = () => {
    const back = returnFocusRef.current;
    const id = lastOpenedIdRef.current;
    returnFocusRef.current = null;
    const map = mapSectionRef.current;
    const target =
      (back?.isConnected ? back : null) ??
      // The map was redrawn while the overlay was open: the same entry's new pin.
      (id ? map?.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(id)}"]`) : null) ??
      map?.querySelector<HTMLElement>(".voyage-map");
    target?.focus({ preventScroll: true });
  };

  const closeAndReadInLogbook = (id: string) => {
    goToAfterCloseRef.current = id;
    setOpened(null);
  };

  const showWholeRoute = () => {
    setSelectedId(null);
    setFitNonce((value) => value + 1);
  };

  if (!data) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-6xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        {failed ? (
          <>
            <p className="font-heading text-lg font-semibold text-foreground">
              The voyage page could not be loaded
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              This is a problem with the website, not with the boat. Please try again in a moment.
            </p>
            <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
              Try again
            </Button>
          </>
        ) : (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the latest position
          </p>
        )}
      </div>
    );
  }

  if (!voyage) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-6xl flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <Sailboat className="h-8 w-8 text-primary" />
        <p className="font-heading text-xl font-semibold text-foreground">
          The crossing has not been announced yet
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The route, the departure date and the live position will appear here.
        </p>
      </div>
    );
  }

  const origin: LatLon = [voyage.origin.lat, voyage.origin.lon];
  const sinceFix = stats ? serverNow - stats.positionTime : null;
  const quiet = sinceFix !== null && sinceFix > QUIET_MS;
  const landed = status === "arrived";
  const progressPercent = landed ? 100 : stats ? Math.round(stats.progress * 100) : 0;
  const longestRun = stats ? Math.max(1, ...stats.dailyRuns.map((run) => run.nm)) : 1;
  const manyRuns = (stats?.dailyRuns.length ?? 0) > 12;
  const weather = data.weather;
  // The map is rebuilt when what it draws changes.
  const mapKey = `${data.track.length}:${data.track[data.track.length - 1]?.[2] ?? 0}:${entries.length}:${voyage.planned_route.length}`;

  let statusLine: ReactNode;
  if (status === "planned") {
    statusLine = departure ? (
      <>
        <span className="font-semibold text-foreground">Leaving {fullDate(departure)}</span>
        <span aria-hidden="true">·</span>
        <span>
          {clock(departure)} · in {formatSpan(departure - serverNow)}
        </span>
      </>
    ) : (
      <span className="font-semibold text-foreground">Departure date to be confirmed</span>
    );
  } else if (status === "arrived") {
    statusLine = (
      <>
        <span className="font-semibold text-foreground">
          Arrived{arrival ? ` ${fullDate(arrival)}` : ""}
        </span>
        {departure && arrival ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{formatDuration((arrival - departure) / 3_600_000)} at sea</span>
          </>
        ) : null}
      </>
    );
  } else {
    statusLine = (
      <>
        <span className="font-semibold text-foreground">Under way</span>
        {departure ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Day {Math.floor((serverNow - departure) / DAY_MS) + 1}</span>
          </>
        ) : null}
        <span aria-hidden="true">·</span>
        <span>
          {sinceFix === null
            ? "waiting for the first position"
            : `last position ${formatSpan(sinceFix)} ago`}
        </span>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {voyage.eyebrow || "Atlantic crossing"}
        </p>
        <h1 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-3xl font-semibold leading-tight sm:text-4xl">
          {voyage.origin.name}
          <ArrowRight className="h-6 w-6 text-primary sm:h-7 sm:w-7" aria-label="to" />
          {voyage.destination.name}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {status === "under_way" ? (
            <span className="relative flex h-2.5 w-2.5">
              {!quiet && sinceFix !== null ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
              ) : null}
              <span
                className={cn(
                  "relative inline-flex h-2.5 w-2.5 rounded-full",
                  quiet || sinceFix === null ? "bg-amber-400" : "bg-emerald-400"
                )}
              />
            </span>
          ) : null}
          {statusLine}
        </p>
      </header>

      <section
        ref={mapSectionRef}
        aria-label="Map"
        className="relative isolate mt-7 h-[400px] overflow-hidden rounded-2xl border border-border/80 shadow-soft sm:h-[480px] lg:h-[540px]"
      >
        <VoyageMap
          key={mapKey}
          planned={voyage.planned_route}
          track={trackLine}
          current={stats?.position ?? null}
          headingDeg={stats?.courseDeg ?? null}
          from={{ name: voyage.origin.name, pos: origin }}
          to={{ name: voyage.destination.name, pos: destination as LatLon }}
          pins={pins}
          boatEntryId={boatEntryId}
          selectedId={selectedId}
          focus={focus}
          fitNonce={fitNonce}
          viewRef={mapViewRef}
          onSelect={openEntry}
        />

        {stats ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[1001] rounded-xl border border-border/70 bg-background/85 px-4 py-3 backdrop-blur-md">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {status === "arrived" ? "Final position" : "Last position"}
            </p>
            <p className="mt-1 font-heading text-base font-semibold tabular-nums text-foreground sm:text-lg">
              {formatCoord(stats.position)}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {stats.courseDeg !== null && stats.speedKn !== null && status !== "arrived"
                ? `${Math.round(stats.courseDeg)}° ${compassPoint(stats.courseDeg)} · ${stats.speedKn.toFixed(1)} kn · `
                : ""}
              {dayMonth(stats.positionTime)}, {clock(stats.positionTime)}
            </p>
          </div>
        ) : null}

        <ul className="pointer-events-none absolute right-3 top-3 z-[1001] hidden space-y-1.5 rounded-xl border border-border/70 bg-background/85 px-4 py-3 text-xs text-muted-foreground backdrop-blur-md sm:block">
          <li className="flex items-center gap-2.5">
            <span className="h-0.5 w-6 rounded-full bg-primary" />
            Sailed
          </li>
          <li className="flex items-center gap-2.5">
            <span className="w-6 border-t border-dashed border-slate-300/70" />
            Planned
          </li>
          <li className="flex items-center gap-2.5">
            <span className="ml-1.5 mr-1.5 h-3 w-3 rounded-full border-2 border-primary" />
            Log entry
          </li>
        </ul>

        {selectedEntry ? (
          <div className="absolute bottom-8 left-3 right-14 z-[1001] flex gap-3 rounded-xl border border-border/80 bg-background/92 p-3 shadow-soft backdrop-blur-md sm:bottom-3 sm:right-auto sm:w-[23rem]">
            {selectedEntry.photos[0] ? (
              <img
                src={photoUrl(selectedEntry.photos[0].id, "thumb")}
                alt=""
                className="h-[72px] w-[72px] shrink-0 rounded-lg object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary">
                {dayLabel(selectedEntry)} · {dayMonth(selectedEntry.time)}
              </p>
              <p className="mt-0.5 truncate font-heading text-sm font-semibold text-foreground">
                {selectedEntry.title || "Log entry"}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {selectedEntry.body}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={() => openEntry(selectedEntry.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Maximize2 className="h-3 w-3" />
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => readEntry(selectedEntry.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  In the logbook
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={showWholeRoute}
            className="absolute bottom-8 left-3 z-[1001] inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/85 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground sm:bottom-3"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Whole route
          </button>
        )}
      </section>

      {stats ? (
        <>
          <section aria-label="Progress" className="panel-soft mt-5 rounded-2xl px-5 py-5 sm:px-6">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground">{voyage.origin.name}</span>
              <span className="font-heading text-sm font-semibold text-primary">
                {status === "arrived" ? "Arrived" : `${progressPercent}% of the way`}
              </span>
              <span className="font-semibold text-foreground">{voyage.destination.name}</span>
            </div>
            <div
              className="relative mt-3 h-2 rounded-full bg-secondary"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Share of the crossing completed"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-primary shadow-[0_0_0_1px_hsl(var(--primary))]"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between gap-3 text-xs tabular-nums text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{nm(stats.sailedNm)} nm</span> sailed
              </span>
              {landed ? null : (
                <span>
                  <span className="font-semibold text-foreground">{nm(stats.toGoNm)} nm</span> to
                  go
                </span>
              )}
            </div>
          </section>

          <section aria-label="Key figures" className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon={<Gauge className="h-4 w-4" />}
              label="Average speed"
              value={stats.averageKn === null ? "No data yet" : `${stats.averageKn.toFixed(1)} kn`}
              hint="Since departure"
            />
            <StatTile
              icon={<Trophy className="h-4 w-4" />}
              label="Best 24 hours"
              value={stats.bestRun ? `${nm(stats.bestRun.nm)} nm` : "No data yet"}
              hint={stats.bestRun ? `Day ${stats.bestRun.day}` : "After the first full day"}
            />
            <StatTile
              icon={<Timer className="h-4 w-4" />}
              label="Time at sea"
              value={formatDuration(stats.elapsedHours)}
              hint={departure ? `Left ${dayMonth(departure)}, ${clock(departure)}` : ""}
            />
            {status === "arrived" ? (
              <StatTile
                icon={<CalendarClock className="h-4 w-4" />}
                label="Landfall"
                value={arrival ? dayMonth(arrival) : "Arrived"}
                hint={arrival ? clock(arrival) : ""}
              />
            ) : (
              <StatTile
                icon={<CalendarClock className="h-4 w-4" />}
                label="Estimated arrival"
                value={stats.eta ? dayMonth(stats.eta) : "No data yet"}
                hint="At the average speed so far"
              />
            )}
          </section>

          <section className={cn("mt-4 grid gap-4", weather && "lg:grid-cols-[1.45fr_1fr]")}>
            <div className="panel-soft rounded-2xl p-5 sm:p-6">
              <h2 className="font-heading text-base font-semibold text-foreground">Daily runs</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Nautical miles sailed in each 24 hours since departure.
              </p>
              <div className={cn("mt-5 flex h-40 items-end", manyRuns ? "gap-1" : "gap-2 sm:gap-3")}>
                {stats.dailyRuns.map((run) => {
                  const isBest = stats.bestRun?.day === run.day;

                  return (
                    <div
                      key={run.day}
                      title={`Day ${run.day}: ${nm(run.nm)} nm${run.complete ? "" : " so far"}`}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    >
                      <span
                        className={cn(
                          "mb-1.5 text-[0.7rem] font-semibold tabular-nums",
                          isBest ? "text-primary" : "text-muted-foreground",
                          manyRuns && "hidden md:inline"
                        )}
                      >
                        {nm(run.nm)}
                      </span>
                      <div
                        className={cn(
                          "w-full rounded-t-md",
                          isBest ? "bg-primary" : "bg-primary/30",
                          !run.complete && "bg-primary/15 outline-dashed outline-1 -outline-offset-1 outline-primary/40"
                        )}
                        style={{ height: `${Math.max(1, (run.nm / longestRun) * 72)}%` }}
                      />
                      <span className="mt-2 truncate text-[0.68rem] tabular-nums text-muted-foreground">
                        {run.day}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[0.68rem] text-muted-foreground">
                Day of the crossing. The last bar is still in progress.
              </p>
            </div>

            {weather ? (
              <div className="panel-soft rounded-2xl p-5 sm:p-6">
                <h2 className="font-heading text-base font-semibold text-foreground">
                  Weather at the boat
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Forecast for the last position, not measured on board.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
                  <ConditionRow
                    icon={<Wind className="h-4 w-4" />}
                    label="Wind"
                    value={
                      weather.wind_kn === null
                        ? "No data"
                        : `${weather.wind_dir_deg === null ? "" : `${compassPoint(weather.wind_dir_deg)} `}${Math.round(weather.wind_kn)} kn`
                    }
                    detail={weather.gust_kn === null ? "" : `Gusts ${Math.round(weather.gust_kn)} kn`}
                  />
                  <ConditionRow
                    icon={<Waves className="h-4 w-4" />}
                    label="Waves"
                    value={one(weather.wave_m, "m")}
                    detail={
                      weather.wave_dir_deg === null || weather.wave_period_s === null
                        ? ""
                        : `From the ${compassPoint(weather.wave_dir_deg)}, ${Math.round(weather.wave_period_s)} s apart`
                    }
                  />
                  <ConditionRow
                    icon={<Thermometer className="h-4 w-4" />}
                    label="Air"
                    value={weather.air_c === null ? "No data" : `${Math.round(weather.air_c)} °C`}
                    detail="Two metres above the sea"
                  />
                  <ConditionRow
                    icon={<Thermometer className="h-4 w-4" />}
                    label="Water"
                    value={weather.sea_c === null ? "No data" : `${Math.round(weather.sea_c)} °C`}
                    detail="Sea surface"
                  />
                </div>
                <p className="mt-4 text-[0.68rem] text-muted-foreground">
                  Weather data by{" "}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Open-Meteo
                  </a>
                  .
                </p>
              </div>
            ) : null}
          </section>
        </>
      ) : status === "under_way" ? (
        <p className="panel-soft mt-5 rounded-2xl px-5 py-5 text-sm text-muted-foreground sm:px-6">
          No position has arrived yet. The track and the figures appear with the first one.
        </p>
      ) : null}

      <section className="mt-14 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Logbook
              </p>
              <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                Notes from on board
              </h2>
            </div>
            {entries.length > 0 ? (
              <p className="pb-1 text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? "entry" : "entries, newest first"}
              </p>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <p className="panel-soft mt-6 rounded-2xl p-5 text-sm text-muted-foreground sm:p-6">
              Nothing in the logbook yet. Entries and photos from the crew will appear here.
            </p>
          ) : (
            <ol className="mt-6 space-y-4">
              {entriesNewestFirst.map((entry) => (
                <li key={entry.id}>
                  <article
                    id={`entry-${entry.id}`}
                    tabIndex={-1}
                    className={cn(
                      "panel-soft scroll-mt-28 rounded-2xl p-5 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6",
                      selectedId === entry.id && "ring-1 ring-primary/70"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold uppercase tracking-[0.1em] text-primary">
                        {dayLabel(entry)}
                      </span>
                      <span className="tabular-nums">
                        {dayMonth(entry.time)}, {clock(entry.time)}
                      </span>
                      {entry.pos ? (
                        <span className="tabular-nums">{formatCoord(entry.pos)}</span>
                      ) : null}
                    </div>

                    {entry.title ? (
                      <h3 className="mt-3 font-heading text-lg font-semibold text-foreground">
                        {entry.title}
                      </h3>
                    ) : null}
                    {entry.body ? (
                      <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                        {entry.body}
                      </p>
                    ) : null}

                    {entry.photos.length > 0 ? (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {entry.photos.map((photo, index) => (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => setLightbox({ photo, entry })}
                            aria-label={`Open photo ${index + 1} of ${entry.photos.length}`}
                            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border/70 bg-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <img
                              src={photoUrl(photo.id, "thumb")}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      {entry.author ? <span>Written by {entry.author}</span> : null}
                      {entry.photos.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-primary" />
                          {entry.photos.length} {entry.photos.length === 1 ? "photo" : "photos"}
                        </span>
                      ) : null}
                      {entry.pos ? (
                        <button
                          type="button"
                          onClick={() => showOnMap(entry.id)}
                          className="ml-auto inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Show on map
                        </button>
                      ) : null}
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="panel-soft rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <LifeBuoy className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-base font-semibold text-foreground">
                If the dot stops moving
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Positions arrive when the satellite dish on board is switched on. A gap of a day or
              more is normal and almost always means the dish is off, or the phone that records the
              track needs a restart.
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
              A quiet map is not a distress signal.
            </p>
          </div>

          {voyage.boat_name ? (
            <div className="panel-soft rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <Sailboat className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-base font-semibold text-foreground">The boat</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {voyage.boat_name}
              </p>
            </div>
          ) : null}
        </aside>
      </section>

      <Dialog open={openedEntry !== null} onOpenChange={(open) => !open && setOpened(null)}>
        <DialogContent
          className="flex max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden border-border/80 bg-card p-0 focus:outline-none [&>button]:rounded-full [&>button]:bg-background/80 [&>button]:p-1.5 [&>button]:opacity-100 [&>button]:backdrop-blur-sm"
          onOpenAutoFocus={(event) => {
            // Focus the scrolling part rather than the first button (a photo thumbnail),
            // so the arrow keys, Space and Page Down scroll a long entry straight away.
            event.preventDefault();
            (overlayScrollerRef.current ?? (event.currentTarget as HTMLElement)).focus();
          }}
          onPointerDownOutside={(event) => {
            // The second press of a double-click on a pin lands outside the overlay
            // it has just opened. It must not close it again.
            if (Date.now() - openedAtRef.current < 400) {
              event.preventDefault();
            }
          }}
          onCloseAutoFocus={(event) => {
            // The overlay has no trigger button of its own, so focus is handed on here.
            event.preventDefault();
            const id = goToAfterCloseRef.current;
            goToAfterCloseRef.current = null;
            if (id) {
              // Going on to the logbook: focus goes to the entry there, not back to the map.
              returnFocusRef.current = null;
              window.setTimeout(() => readEntry(id), 0);
            } else {
              focusAfterOverlay();
            }
          }}
        >
          {shown ? (
            <>
              {/* Photo and text scroll together, so a long entry is not read through a slit under a fixed photo. */}
              <div
                ref={overlayScrollerRef}
                tabIndex={0}
                className="min-h-0 flex-1 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]"
              >
                {shown.photo ? (
                  <div className="bg-black">
                    <img
                      key={shown.photo.id}
                      src={photoUrl(shown.photo.id)}
                      alt=""
                      width={shown.photo.w}
                      height={shown.photo.h}
                      className="max-h-[44vh] w-full object-contain"
                    />
                    {shown.entry.photos.length > 1 ? (
                      <div className="flex gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]">
                        {shown.entry.photos.map((photo, index) => (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => openedEntry && setOpened({ id: openedEntry.id, photo: index })}
                            aria-label={`Show photo ${index + 1} of ${shown.entry.photos.length}`}
                            aria-pressed={photo.id === shown.photo.id}
                            className={cn(
                              "h-12 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              photo.id === shown.photo.id
                                ? "border-primary"
                                : "border-transparent opacity-60 hover:opacity-100"
                            )}
                          >
                            <img
                              src={photoUrl(photo.id, "thumb")}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="px-5 py-5 sm:px-6">
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
                      // Without a photo the close button sits beside this line.
                      !shown.photo && "pr-10"
                    )}
                  >
                    <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold uppercase tracking-[0.1em] text-primary">
                      {dayLabel(shown.entry)}
                    </span>
                    <span className="tabular-nums">
                      {dayMonth(shown.entry.time)}, {clock(shown.entry.time)}
                    </span>
                    {shown.entry.pos ? (
                      <span className="tabular-nums">{formatCoord(shown.entry.pos)}</span>
                    ) : null}
                  </div>
                  <DialogTitle className="mt-3 break-words font-heading text-xl font-semibold leading-snug text-foreground">
                    {shown.entry.title || "Log entry"}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Log entry of {dayMonth(shown.entry.time)}, {clock(shown.entry.time)}
                  </DialogDescription>
                  {shown.entry.body ? (
                    <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                      {shown.entry.body}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 px-5 py-3 text-xs text-muted-foreground sm:px-6">
                {shown.entry.author ? <span>Written by {shown.entry.author}</span> : null}
                {shown.entry.photos.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-primary" />
                    {shown.entry.photos.length} {shown.entry.photos.length === 1 ? "photo" : "photos"}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => closeAndReadInLogbook(shown.entry.id)}
                  className="ml-auto inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                >
                  In the logbook
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden border-border/80 bg-card p-0">
          {lightbox ? (
            <>
              <img
                src={photoUrl(lightbox.photo.id)}
                alt=""
                width={lightbox.photo.w}
                height={lightbox.photo.h}
                className="max-h-[75vh] w-full bg-black object-contain"
              />
              <div className="px-5 py-4">
                <DialogTitle className="font-heading text-base font-semibold">
                  {lightbox.entry.title || "Photo from the log"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs tabular-nums">
                  {dayLabel(lightbox.entry)} · {dayMonth(lightbox.entry.time)}
                  {lightbox.entry.pos ? ` · ${formatCoord(lightbox.entry.pos)}` : ""}
                </DialogDescription>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VoyagePage;
