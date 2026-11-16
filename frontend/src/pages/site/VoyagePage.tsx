import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
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
import VoyageLanguageSwitch from "@/components/voyage/VoyageLanguageSwitch";
import VoyageMap, { type MapView, type VoyageMapPin } from "@/components/voyage/VoyageMap";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { distanceNm, rhumbPathLengthNm, type LatLon } from "@/lib/geo";
import { useVoyageTexts } from "@/lib/useVoyageTexts";
import {
  fetchVoyage,
  photoUrl,
  type VoyageData,
  type VoyageEntry,
  type VoyagePhotoRef,
  type VoyagePort,
  type VoyageWeather,
} from "@/lib/voyageApi";
import { MIN_SPEED_KN, compareWithPlan, projectCourse, steadyCourse } from "@/lib/voyageCourse";
import { computeStats, toFixes } from "@/lib/voyageStats";
import { cn } from "@/lib/utils";

const REFRESH_MS = 5 * 60_000;
const DAY_MS = 86_400_000;
/** Past this long without a position, the status dot turns amber. */
const QUIET_MS = 24 * 3_600_000;
/** Within this distance of the boat, the newest entry opens from the boat marker instead of its own pin. */
const NEAR_BOAT_NM = 60;
/** How far ahead the present course is drawn on the map. */
const AHEAD_HOURS = [24, 48];
/** A course taken from a position older than this says little about where the boat is heading now. */
const AHEAD_MAX_AGE_MS = 12 * 3_600_000;
/** Closer to the plan than this counts as being on it: the figures are not finer than that. */
const ON_COURSE_DEG = 3;
const ON_ROUTE_NM = 2;

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

interface WeatherPanelProps {
  weather: VoyageWeather;
  title: string;
  caption: string;
  /**
   * For a place on land. What the forecast has no figure for is left out instead
   * of reading "No data": the sea-state service often has none inside a harbour.
   */
  ashore?: boolean;
}

const WeatherPanel = ({ weather, title, caption, ashore = false }: WeatherPanelProps) => {
  const { t, rich, number, compass } = useVoyageTexts();
  const wholeKnots = (value: number) => t("unit.knots", { value: number(value) });
  const noData = t("common.noData");
  const rows = [
    {
      key: "wind",
      missing: weather.wind_kn === null,
      icon: <Wind className="h-4 w-4" />,
      label: t("public.weather.wind"),
      value:
        weather.wind_kn === null
          ? noData
          : weather.wind_dir_deg === null
            ? wholeKnots(weather.wind_kn)
            : t("public.weather.windFrom", {
                direction: compass(weather.wind_dir_deg),
                speed: wholeKnots(weather.wind_kn),
              }),
      detail:
        weather.gust_kn === null
          ? ""
          : t("public.weather.gusts", { speed: wholeKnots(weather.gust_kn) }),
    },
    {
      key: "waves",
      missing: weather.wave_m === null,
      icon: <Waves className="h-4 w-4" />,
      label: t("public.weather.waves"),
      value:
        weather.wave_m === null ? noData : t("unit.metres", { value: number(weather.wave_m, 1) }),
      detail:
        weather.wave_dir_deg === null || weather.wave_period_s === null
          ? ""
          : t("public.weather.wavesDetail", {
              direction: compass(weather.wave_dir_deg),
              seconds: Math.round(weather.wave_period_s),
            }),
    },
    {
      key: "air",
      missing: weather.air_c === null,
      icon: <Thermometer className="h-4 w-4" />,
      label: t("public.weather.air"),
      value: weather.air_c === null ? noData : t("unit.celsius", { value: number(weather.air_c) }),
      detail: ashore ? t("public.weather.airAshore") : t("public.weather.airAtSea"),
    },
    {
      key: "water",
      missing: weather.sea_c === null,
      icon: <Thermometer className="h-4 w-4" />,
      label: t("public.weather.water"),
      value: weather.sea_c === null ? noData : t("unit.celsius", { value: number(weather.sea_c) }),
      detail: t("public.weather.seaSurface"),
    },
  ].filter((row) => !(ashore && row.missing));

  return (
    <div className="panel-soft rounded-2xl p-5 sm:p-6">
      <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      {rows.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
          {rows.map((row) => (
            <ConditionRow
              key={row.key}
              icon={row.icon}
              label={row.label}
              value={row.value}
              detail={row.detail}
            />
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">{t("public.weather.none")}</p>
      )}
      <p className="mt-4 text-[0.68rem] text-muted-foreground">
        {rich("public.weather.credit", {
          source: (
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              Open-Meteo
            </a>
          ),
        })}
      </p>
    </div>
  );
};

interface Loaded {
  data: VoyageData;
  /** Difference between the server's clock and this device's, in ms. */
  clockOffset: number;
}

const VoyagePage = () => {
  const texts = useVoyageTexts();
  const { t, rich, dayMonth, fullDate, clock, miles, knots, compass, coord } = texts;
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
  /** The entry last shown in the overlay, to find its pin when the overlay closes. */
  const lastOpenedIdRef = useRef<string | null>(null);
  /** True once the visitor has stepped on from the entry the overlay was opened with. */
  const steppedRef = useRef(false);
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

  /**
   * Entries written in port have no position: nothing is published about where
   * the boat and the crew are before departure or after landfall. `port` gives the
   * port each of them belongs to (before departure: where the crossing starts;
   * after landfall: where it ends). `pinned` holds the newest one from each port,
   * which is drawn on the map at the port itself, a place that is public anyway.
   */
  const ashore = useMemo(() => {
    const port = new Map<string, VoyagePort>();
    const newest = new Map<VoyagePort, string>();
    if (voyage) {
      // Oldest first, so the last one seen for a port is its newest.
      for (const entry of entries) {
        if (entry.pos !== null) {
          continue;
        }
        const time = Date.parse(entry.time);
        const where =
          departure === null || time < departure
            ? voyage.origin
            : arrival !== null && time > arrival
              ? voyage.destination
              : null;
        if (where) {
          port.set(entry.id, where);
          newest.set(where, entry.id);
        }
      }
    }
    return { port, pinned: new Set(newest.values()) };
  }, [entries, voyage, departure, arrival]);

  // The newest entry opens from the boat itself when it was written where the boat
  // is, or in the port the boat is lying in: a pin of its own would sit under the boat.
  const latestPort =
    latestEntry && ashore.pinned.has(latestEntry.id) ? ashore.port.get(latestEntry.id) : undefined;
  const latestPlace: LatLon | null =
    latestEntry?.pos ?? (latestPort ? [latestPort.lat, latestPort.lon] : null);
  const boatEntryId =
    stats && latestEntry && latestPlace && distanceNm(latestPlace, stats.position) < NEAR_BOAT_NM
      ? latestEntry.id
      : undefined;

  const sameOriginAndDestination =
    voyage !== null &&
    voyage.origin.lat === voyage.destination.lat &&
    voyage.origin.lon === voyage.destination.lon;

  const pins = useMemo<VoyageMapPin[]>(
    () =>
      entries.flatMap((entry) => {
        const port = ashore.pinned.has(entry.id) ? ashore.port.get(entry.id) : undefined;
        const pos: LatLon | null = entry.pos ?? (port ? [port.lat, port.lon] : null);
        return pos === null || entry.id === boatEntryId
          ? []
          : [
              {
                id: entry.id,
                label: String(entryNumbers.get(entry.id)),
                title: entry.title || t("common.logEntry"),
                pos,
                // Just below the port's own dot, clear of an entry written right there.
                // On a round trip both ports are one place: the second pin goes beside the first.
                ...(port
                  ? {
                      offset: (port === voyage?.destination && sameOriginAndDestination
                        ? [26, 24]
                        : [0, 24]) as [number, number],
                    }
                  : {}),
              },
            ];
      }),
    [entries, entryNumbers, boatEntryId, ashore, voyage, sameOriginAndDestination, t]
  );

  // The boat's course set against the planned route, while it is under way.
  const underWay = status === "under_way";
  // Judged by the server's clock as of this fetch rather than by a clock that
  // ticks, so that at the twelve-hour mark the answer changes once, not back and forth.
  const positionIsRecent =
    stats !== null &&
    data !== null &&
    Date.parse(data.server_time) - stats.positionTime < AHEAD_MAX_AGE_MS;
  // The one course that both the line on the map and the figures under it go by.
  const course =
    stats && positionIsRecent ? steadyCourse(stats.courseDeg, stats.speedKn) : null;
  const plan = useMemo(
    () =>
      underWay && stats && voyage
        ? compareWithPlan(stats.position, course, voyage.planned_route)
        : null,
    [underWay, stats, voyage, course]
  );
  const ahead = useMemo(
    () =>
      underWay && stats ? projectCourse(stats.position, course, stats.speedKn, AHEAD_HOURS) : [],
    [underWay, stats, course]
  );
  const whyNoCourse = !positionIsRecent
    ? t("public.course.old")
    : stats?.speedKn != null && stats.speedKn < MIN_SPEED_KN
      ? t("public.course.stopped")
      : t("public.course.unknown");

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
  // The entries written just before and just after the one shown.
  const shownIndex = shown ? entries.findIndex((entry) => entry.id === shown.entry.id) : -1;
  const earlierEntry = shownIndex > 0 ? entries[shownIndex - 1] : null;
  const laterEntry =
    shownIndex >= 0 && shownIndex < entries.length - 1 ? entries[shownIndex + 1] : null;

  const openedId = opened?.id ?? null;
  useEffect(() => {
    // Stepping to another entry starts it at its top. Not on closing: the entry
    // would jump to its top while it fades out.
    if (openedId) {
      overlayScrollerRef.current?.scrollTo({ top: 0 });
    }
  }, [openedId]);

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
      return t("public.entry.beforeDeparture");
    }
    if (arrival !== null && time > arrival) {
      return t("public.entry.afterLandfall");
    }
    return t("common.day", { day: Math.floor((time - departure) / DAY_MS) + 1 });
  };

  /** A port's name in the page's language, when the shore contact gave one. */
  const portName = (port: VoyagePort | undefined) =>
    port ? texts.own(port.name, port.name_ro) : "";

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
    const active = document.activeElement;
    // Some browsers do not focus a button that is clicked: <body> is then "active",
    // which is no place to return to.
    returnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    lastOpenedIdRef.current = id;
    steppedRef.current = false;
    openedAtRef.current = Date.now();
    setSelectedId(id);
    setOpened({ id, photo: 0 });
  };

  /**
   * Where focus goes when the overlay closes: back to what opened it. If the visitor
   * stepped on to another entry, to that entry's pin instead, when it has one; and to
   * the pin as well when what opened the overlay is gone (the map was redrawn).
   */
  const focusAfterOverlay = () => {
    const back = returnFocusRef.current?.isConnected ? returnFocusRef.current : null;
    const id = lastOpenedIdRef.current;
    returnFocusRef.current = null;
    const map = mapSectionRef.current;
    const pin = id
      ? map?.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(id)}"]`) ?? null
      : null;
    const target =
      (steppedRef.current ? pin ?? back : back ?? pin) ??
      map?.querySelector<HTMLElement>(".voyage-map");
    if (id && map && target === pin && pin) {
      // After stepping, that pin can lie outside the part of the map in view.
      const frame = map.getBoundingClientRect();
      const box = pin.getBoundingClientRect();
      const inView =
        box.left >= frame.left &&
        box.right <= frame.right &&
        box.top >= frame.top &&
        box.bottom <= frame.bottom;
      if (!inView) {
        setFocus({ id, nonce: Date.now() });
      }
    }
    target?.focus({ preventScroll: true });
  };

  /** In the overlay, on to the entry written before or after the one shown. */
  const stepTo = (entry: VoyageEntry | null) => {
    if (!entry || !openedEntry) {
      return;
    }
    lastOpenedIdRef.current = entry.id;
    steppedRef.current = true;
    setSelectedId(entry.id);
    setOpened({ id: entry.id, photo: 0 });
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
      <div lang={texts.htmlLang} className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex justify-end">
          <VoyageLanguageSwitch />
        </div>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-10 text-center">
          {failed ? (
            <>
              <p className="font-heading text-lg font-semibold text-foreground">
                {t("public.loadFailed.title")}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("public.loadFailed.body")}
              </p>
              <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
                {t("public.tryAgain")}
              </Button>
            </>
          ) : (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("public.loading")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!voyage) {
    return (
      <div lang={texts.htmlLang} className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex justify-end">
          <VoyageLanguageSwitch />
        </div>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 py-10 text-center">
          <Sailboat className="h-8 w-8 text-primary" />
          <p className="font-heading text-xl font-semibold text-foreground">
            {t("public.notAnnounced.title")}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("public.notAnnounced.body")}
          </p>
        </div>
      </div>
    );
  }

  const originName = portName(voyage.origin);
  const destinationName = portName(voyage.destination);
  const origin: LatLon = [voyage.origin.lat, voyage.origin.lon];
  const sinceFix = stats ? serverNow - stats.positionTime : null;
  const quiet = sinceFix !== null && sinceFix > QUIET_MS;
  const landed = status === "arrived";
  const progressPercent = landed ? 100 : stats ? Math.round(stats.progress * 100) : 0;
  const longestRun = stats ? Math.max(1, ...stats.dailyRuns.map((run) => run.nm)) : 1;
  const manyRuns = (stats?.dailyRuns.length ?? 0) > 12;
  const weather = data.weather;
  // The hour the forecast is for. The service gives it in UTC without saying so.
  const forecastAt = weather?.time ? Date.parse(`${weather.time}Z`) : Number.NaN;
  const forecastTime = Number.isNaN(forecastAt) ? null : forecastAt;
  // The length of the dashed line as the map draws it.
  const plannedNm = rhumbPathLengthNm(voyage.planned_route);
  // The map is rebuilt when what it draws changes.
  const mapKey = [
    data.track.length,
    data.track[data.track.length - 1]?.[2] ?? 0,
    entries.length,
    voyage.planned_route.length,
    // The ports and the two dates decide where entries written in port are drawn.
    JSON.stringify([voyage.origin, voyage.destination, voyage.departure, voyage.arrived_at]),
    // The course ahead disappears once the last position has grown old.
    ahead.length,
    // The map writes a few words of its own.
    texts.language,
  ].join(":");

  let statusLine: ReactNode;
  if (status === "planned") {
    statusLine = departure ? (
      <>
        <span className="font-semibold text-foreground">
          {t("public.status.leaving", { date: fullDate(departure) })}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {t("public.status.leavingAt", {
            time: clock(departure),
            span: texts.span(departure - serverNow),
          })}
        </span>
      </>
    ) : (
      <span className="font-semibold text-foreground">{t("public.status.departureOpen")}</span>
    );
  } else if (status === "arrived") {
    statusLine = (
      <>
        <span className="font-semibold text-foreground">
          {arrival
            ? t("public.status.arrivedOn", { date: fullDate(arrival) })
            : t("public.status.arrived")}
        </span>
        {departure && arrival ? (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {t("public.status.atSea", {
                duration: texts.durationLong((arrival - departure) / 3_600_000),
              })}
            </span>
          </>
        ) : null}
      </>
    );
  } else {
    statusLine = (
      <>
        <span className="font-semibold text-foreground">{t("public.status.underWay")}</span>
        {departure ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{t("common.day", { day: Math.floor((serverNow - departure) / DAY_MS) + 1 })}</span>
          </>
        ) : null}
        <span aria-hidden="true">·</span>
        <span>
          {sinceFix === null
            ? t("public.status.waiting")
            : t("public.status.lastPosition", { span: texts.span(sinceFix) })}
        </span>
      </>
    );
  }

  return (
    <div
      lang={texts.htmlLang}
      className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
    >
      <header>
        <div className="flex items-start justify-between gap-4">
          <p className="pt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {texts.own(voyage.eyebrow, voyage.eyebrow_ro) || t("public.eyebrow")}
          </p>
          <VoyageLanguageSwitch />
        </div>
        <h1 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-3xl font-semibold leading-tight sm:text-4xl">
          {originName}
          <ArrowRight className="h-6 w-6 text-primary sm:h-7 sm:w-7" aria-label={t("public.to")} />
          {destinationName}
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
        aria-label={t("public.map.label")}
        className="relative isolate mt-7 h-[400px] overflow-hidden rounded-2xl border border-border/80 shadow-soft sm:h-[480px] lg:h-[540px]"
      >
        <VoyageMap
          key={mapKey}
          planned={voyage.planned_route}
          track={trackLine}
          current={stats?.position ?? null}
          headingDeg={stats?.courseDeg ?? null}
          ahead={ahead}
          from={{ name: originName, pos: origin }}
          to={{ name: destinationName, pos: destination as LatLon }}
          text={{
            description: t("public.map.description"),
            latestPosition: t("public.map.latestPosition"),
            zoomIn: t("public.map.zoomIn"),
            zoomOut: t("public.map.zoomOut"),
            west: texts.point("W"),
          }}
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
              {status === "arrived" ? t("public.map.finalPosition") : t("public.map.lastPosition")}
            </p>
            <p className="mt-1 font-heading text-base font-semibold tabular-nums text-foreground sm:text-lg">
              {coord(stats.position)}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {stats.courseDeg !== null && stats.speedKn !== null && status !== "arrived"
                ? `${Math.round(stats.courseDeg)}° ${compass(stats.courseDeg)} · ${knots(stats.speedKn)} · `
                : ""}
              {dayMonth(stats.positionTime)}, {clock(stats.positionTime)}
            </p>
          </div>
        ) : null}

        <ul className="pointer-events-none absolute right-3 top-3 z-[1001] hidden space-y-1.5 rounded-xl border border-border/70 bg-background/85 px-4 py-3 text-xs text-muted-foreground backdrop-blur-md sm:block">
          <li className="flex items-center gap-2.5">
            <span className="h-0.5 w-6 rounded-full bg-primary" />
            {t("public.map.sailed")}
          </li>
          <li className="flex items-center gap-2.5">
            <span className="w-6 border-t border-dashed border-slate-300/70" />
            {t("public.map.planned")}
          </li>
          {ahead.length > 0 ? (
            <li className="flex items-center gap-2.5">
              <span className="h-0.5 w-6 rounded-full bg-[hsl(38_95%_62%)]" />
              {t("public.map.courseAhead")}
            </li>
          ) : null}
          <li className="flex items-center gap-2.5">
            <span className="ml-1.5 mr-1.5 h-3 w-3 rounded-full border-2 border-primary" />
            {t("common.logEntry")}
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
                {selectedEntry.title || t("common.logEntry")}
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
                  {t("public.map.open")}
                </button>
                <button
                  type="button"
                  onClick={() => readEntry(selectedEntry.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  {t("public.map.inLogbook")}
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label={t("common.close")}
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
            {t("public.map.wholeRoute")}
          </button>
        )}
      </section>

      {stats ? (
        <>
          <section aria-label={t("public.progress.label")} className="panel-soft mt-5 rounded-2xl px-5 py-5 sm:px-6">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground">{originName}</span>
              <span className="font-heading text-sm font-semibold text-primary">
                {status === "arrived"
                  ? t("public.status.arrived")
                  : t("public.progress.ofTheWay", { percent: progressPercent })}
              </span>
              <span className="font-semibold text-foreground">{destinationName}</span>
            </div>
            <div
              className="relative mt-3 h-2 rounded-full bg-secondary"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("public.progress.bar")}
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
                {rich("public.progress.sailed", {
                  distance: (
                    <span className="font-semibold text-foreground">{miles(stats.sailedNm)}</span>
                  ),
                })}
              </span>
              {landed ? null : (
                <span>
                  {rich("public.progress.toGo", {
                    distance: (
                      <span className="font-semibold text-foreground">{miles(stats.toGoNm)}</span>
                    ),
                  })}
                </span>
              )}
            </div>

            {plan ? (
              <div className="mt-4 border-t border-border/60 pt-4">
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t("public.course.now")}
                    </dt>
                    <dd className="mt-1 font-heading text-base font-semibold tabular-nums text-foreground">
                      {course === null
                        ? whyNoCourse
                        : `${Math.round(course)}° ${compass(course)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t("public.course.planned")}
                    </dt>
                    <dd className="mt-1 font-heading text-base font-semibold tabular-nums text-foreground">
                      {Math.round(plan.plannedDeg)}° {compass(plan.plannedDeg)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t("public.course.against")}
                    </dt>
                    <dd className="mt-1 font-heading text-base font-semibold tabular-nums text-foreground">
                      {plan.turnDeg === null
                        ? t("public.course.none")
                        : Math.abs(plan.turnDeg) < ON_COURSE_DEG
                          ? t("public.course.onCourse")
                          : t(plan.turnDeg < 0 ? "public.course.left" : "public.course.right", {
                              degrees: Math.abs(plan.turnDeg),
                            })}
                    </dd>
                    <dd className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                      {plan.offRouteNm < ON_ROUTE_NM
                        ? t("public.course.onRoute")
                        : t("public.course.offRoute", {
                            distance: miles(plan.offRouteNm),
                            side: texts.point(plan.side),
                          })}
                    </dd>
                  </div>
                </dl>
                {ahead.length > 0 ? (
                  <p className="mt-3 text-[0.68rem] text-muted-foreground">
                    {t("public.course.aheadNote", { count: AHEAD_HOURS[AHEAD_HOURS.length - 1] })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section aria-label={t("public.figures.label")} className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon={<Gauge className="h-4 w-4" />}
              label={t("public.figures.averageSpeed")}
              value={stats.averageKn === null ? t("common.noDataYet") : knots(stats.averageKn)}
              hint={t("public.figures.sinceDeparture")}
            />
            <StatTile
              icon={<Trophy className="h-4 w-4" />}
              label={t("public.figures.best24")}
              value={stats.bestRun ? miles(stats.bestRun.nm) : t("common.noDataYet")}
              hint={
                stats.bestRun
                  ? t("common.day", { day: stats.bestRun.day })
                  : t("public.figures.afterFirstDay")
              }
            />
            <StatTile
              icon={<Timer className="h-4 w-4" />}
              label={t("public.figures.timeAtSea")}
              value={texts.duration(stats.elapsedHours)}
              hint={
                departure
                  ? t("public.figures.left", { date: dayMonth(departure), time: clock(departure) })
                  : ""
              }
            />
            {status === "arrived" ? (
              <StatTile
                icon={<CalendarClock className="h-4 w-4" />}
                label={t("public.figures.landfall")}
                value={arrival ? dayMonth(arrival) : t("public.status.arrived")}
                hint={arrival ? clock(arrival) : ""}
              />
            ) : (
              <StatTile
                icon={<CalendarClock className="h-4 w-4" />}
                label={t("public.figures.eta")}
                value={stats.eta ? dayMonth(stats.eta) : t("common.noDataYet")}
                hint={t("public.figures.etaHint")}
              />
            )}
          </section>

          <section className={cn("mt-4 grid gap-4", weather && "lg:grid-cols-[1.45fr_1fr]")}>
            <div className="panel-soft rounded-2xl p-5 sm:p-6">
              <h2 className="font-heading text-base font-semibold text-foreground">
                {t("public.runs.title")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("public.runs.caption")}
              </p>
              <div className={cn("mt-5 flex h-40 items-end", manyRuns ? "gap-1" : "gap-2 sm:gap-3")}>
                {stats.dailyRuns.map((run) => {
                  const isBest = stats.bestRun?.day === run.day;

                  return (
                    <div
                      key={run.day}
                      title={t(run.complete ? "public.runs.bar" : "public.runs.barSoFar", {
                        day: run.day,
                        distance: miles(run.nm),
                      })}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    >
                      <span
                        className={cn(
                          "mb-1.5 text-[0.7rem] font-semibold tabular-nums",
                          isBest ? "text-primary" : "text-muted-foreground",
                          manyRuns && "hidden md:inline"
                        )}
                      >
                        {texts.number(run.nm)}
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
                {t("public.runs.axis")}
              </p>
            </div>

            {weather ? (
              <WeatherPanel
                weather={weather}
                title={t("public.weather.atBoat")}
                caption={t("public.weather.atBoatCaption")}
              />
            ) : null}
          </section>
        </>
      ) : status === "under_way" ? (
        <p className="panel-soft mt-5 rounded-2xl px-5 py-5 text-sm text-muted-foreground sm:px-6">
          {t("public.noPosition")}
        </p>
      ) : status === "planned" ? (
        <section
          aria-label={t("public.plan.title")}
          className={cn("mt-5 grid gap-4", weather && "lg:grid-cols-[1.45fr_1fr]")}
        >
          <div className="panel-soft rounded-2xl p-5 sm:p-6">
            <h2 className="font-heading text-base font-semibold text-foreground">
              {t("public.plan.title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("public.plan.caption")}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
              {/* Nothing to say for a route that is a single place, such as a round trip with no waypoints yet. */}
              {plannedNm >= 1 ? (
                <div>
                  <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("public.plan.route")}
                  </dt>
                  <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
                    {miles(plannedNm)}
                  </dd>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    {t("public.plan.routeHint")}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t("public.plan.departure")}
                </dt>
                <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
                  {departure ? dayMonth(departure) : t("public.plan.notSet")}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  {departure ? clock(departure) : t("public.plan.from", { port: originName })}
                </dd>
              </div>
            </dl>
          </div>

          {weather ? (
            <WeatherPanel
              weather={weather}
              title={t("public.weather.atPort", { port: originName })}
              caption={
                forecastTime === null
                  ? t("public.weather.portCaption")
                  : t("public.weather.portCaptionAt", { time: clock(forecastTime) })
              }
              ashore
            />
          ) : null}
        </section>
      ) : null}

      <section className="mt-14 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {t("public.logbook.eyebrow")}
              </p>
              <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                {t("public.logbook.title")}
              </h2>
            </div>
            {entries.length > 0 ? (
              <p className="pb-1 text-xs text-muted-foreground">
                {t("public.logbook.count", { count: entries.length })}
              </p>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <p className="panel-soft mt-6 rounded-2xl p-5 text-sm text-muted-foreground sm:p-6">
              {t("public.logbook.empty")}
            </p>
          ) : (
            <ol className="mt-6 space-y-4">
              {entriesNewestFirst.map((entry) => (
                <li key={entry.id}>
                  <article
                    id={`entry-${entry.id}`}
                    tabIndex={-1}
                    className={cn(
                      "panel-soft scroll-mt-6 rounded-2xl p-5 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6",
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
                        <span className="tabular-nums">{coord(entry.pos)}</span>
                      ) : ashore.port.has(entry.id) ? (
                        <span>{portName(ashore.port.get(entry.id))}</span>
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
                            aria-label={t("public.entry.openPhoto", {
                              index: index + 1,
                              total: entry.photos.length,
                            })}
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
                      {entry.author ? (
                        <span>{t("public.entry.writtenBy", { author: entry.author })}</span>
                      ) : null}
                      {entry.photos.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-primary" />
                          {t("common.photos", { count: entry.photos.length })}
                        </span>
                      ) : null}
                      {entry.pos || ashore.pinned.has(entry.id) ? (
                        <button
                          type="button"
                          onClick={() => showOnMap(entry.id)}
                          className="ml-auto inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {t("public.entry.showOnMap")}
                        </button>
                      ) : null}
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="panel-soft rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <LifeBuoy className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-base font-semibold text-foreground">
                {t("public.quiet.title")}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("public.quiet.body")}
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
              {t("public.quiet.strong")}
            </p>
          </div>

          {voyage.boat_name ? (
            <div className="panel-soft rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <Sailboat className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-base font-semibold text-foreground">
                  {t("public.boat")}
                </h2>
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
          lang={texts.htmlLang}
          closeLabel={t("common.close")}
          className="flex max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden border-border/80 bg-card p-0 focus:outline-none [&>button]:rounded-full [&>button]:bg-background/80 [&>button]:p-1.5 [&>button]:opacity-100 [&>button]:backdrop-blur-sm"
          onOpenAutoFocus={(event) => {
            // Focus the scrolling part rather than the first button (a photo thumbnail),
            // so the arrow keys, Space and Page Down scroll a long entry straight away.
            event.preventDefault();
            (overlayScrollerRef.current ?? (event.currentTarget as HTMLElement)).focus();
          }}
          onKeyDown={(event) => {
            // Left and right arrows step through the entries, as the two buttons do.
            // With a modifier they are the browser's (back, forward) or the reader's
            // (extending a selection), and are left alone.
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
              return;
            }
            const target =
              event.key === "ArrowLeft"
                ? earlierEntry
                : event.key === "ArrowRight"
                  ? laterEntry
                  : null;
            if (target) {
              event.preventDefault();
              // A photo thumbnail that has the focus is about to disappear with its
              // entry. The scrolling part takes the focus over, so the keys go on working.
              if (overlayScrollerRef.current?.contains(event.target as Node)) {
                overlayScrollerRef.current.focus({ preventScroll: true });
              }
              stepTo(target);
            }
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
                            aria-label={t("public.entry.showPhoto", {
                              index: index + 1,
                              total: shown.entry.photos.length,
                            })}
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
                      <span className="tabular-nums">{coord(shown.entry.pos)}</span>
                    ) : ashore.port.has(shown.entry.id) ? (
                      <span>{portName(ashore.port.get(shown.entry.id))}</span>
                    ) : null}
                  </div>
                  <DialogTitle className="mt-3 break-words font-heading text-xl font-semibold leading-snug text-foreground">
                    {shown.entry.title || t("common.logEntry")}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {t("public.entry.of", {
                      date: dayMonth(shown.entry.time),
                      time: clock(shown.entry.time),
                    })}
                  </DialogDescription>
                  {shown.entry.body ? (
                    <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                      {shown.entry.body}
                    </p>
                  ) : null}
                  {shown.entry.author || shown.entry.photos.length > 0 ? (
                    <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {shown.entry.author ? (
                        <span>{t("public.entry.writtenBy", { author: shown.entry.author })}</span>
                      ) : null}
                      {shown.entry.photos.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-primary" />
                          {t("common.photos", { count: shown.entry.photos.length })}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 px-5 py-3 text-xs text-muted-foreground sm:px-6">
                {entries.length > 1 && shownIndex >= 0 ? (
                  <>
                    {/* Marked as unavailable rather than disabled, so the button keeps the focus at either end. */}
                    <button
                      type="button"
                      onClick={() => stepTo(earlierEntry)}
                      aria-disabled={!earlierEntry}
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap font-semibold",
                        earlierEntry ? "text-primary hover:underline" : "cursor-default opacity-40"
                      )}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {t("public.entry.earlier")}
                    </button>
                    {/* Read out whole on every step, with the title, which is not announced otherwise. */}
                    <span className="whitespace-nowrap tabular-nums" aria-live="polite" aria-atomic="true">
                      <span className="sr-only">{t("public.entry.counterLead")} </span>
                      {t("public.entry.counter", { index: shownIndex + 1, total: entries.length })}
                      <span className="sr-only">: {shown.entry.title || t("common.logEntry")}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => stepTo(laterEntry)}
                      aria-disabled={!laterEntry}
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap font-semibold",
                        laterEntry ? "text-primary hover:underline" : "cursor-default opacity-40"
                      )}
                    >
                      {t("public.entry.later")}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => closeAndReadInLogbook(shown.entry.id)}
                  className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-primary hover:underline"
                >
                  {t("public.map.inLogbook")}
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent
          lang={texts.htmlLang}
          closeLabel={t("common.close")}
          className="max-w-4xl gap-0 overflow-hidden border-border/80 bg-card p-0"
        >
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
                  {lightbox.entry.title || t("public.entry.photoTitle")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs tabular-nums">
                  {dayLabel(lightbox.entry)} · {dayMonth(lightbox.entry.time)}
                  {lightbox.entry.pos ? ` · ${coord(lightbox.entry.pos)}` : ""}
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
