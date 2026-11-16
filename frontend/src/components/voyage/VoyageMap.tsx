import { useEffect, useRef, type MutableRefObject } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./voyage.css";
import { createSeaLayer, type SeaLayer } from "@/components/voyage/seaLayer";
import type { LatLon } from "@/lib/geo";
import type { SeaForecast, SeaSample } from "@/lib/seaField";
import { cn } from "@/lib/utils";

export interface VoyageMapPin {
  id: string;
  label: string;
  title: string;
  pos: LatLon;
  /**
   * Pixels to draw the pin away from `pos` (right, down). For an entry that stands
   * for a place rather than a position, so it does not sit on the place's own dot
   * or on an entry written right there.
   */
  offset?: [number, number];
}

export interface MapView {
  center: LatLon;
  zoom: number;
}

interface Port {
  name: string;
  pos: LatLon;
}

interface VoyageMapProps {
  planned: LatLon[];
  track: LatLon[];
  /** Latest position. Leave out before the first one arrives. */
  current?: LatLon | null;
  headingDeg?: number | null;
  /**
   * Where the boat would be after some hours on its present course and speed,
   * nearest first. Drawn as a line ahead of the boat. Empty or left out: no line.
   */
  ahead?: { pos: LatLon; hours: number }[];
  from: Port;
  to: Port;
  pins: VoyageMapPin[];
  /** Entry opened when the boat itself is clicked (the newest one). */
  boatEntryId?: string;
  selectedId: string | null;
  /** Change `nonce` to fly the map to an entry. */
  focus: { id: string; nonce: number } | null;
  /** Change to zoom back out to the whole route. */
  fitNonce: number;
  /**
   * Where the visitor has moved the map to. Owned by the page, so the view
   * survives the map being rebuilt when new positions arrive.
   */
  viewRef?: MutableRefObject<MapView | null>;
  onSelect: (id: string) => void;
  /** The forecast (waves or wind) to lay over the sea, and which of its time steps. Null or left out: none. */
  sea?: { forecast: SeaForecast; step: number } | null;
  /** The figures for a spot that was clicked, in words. */
  describeSea?: (sample: SeaSample, forecast: SeaForecast) => string;
  /** The map's own words, in the page's language. English when left out. */
  text?: Partial<MapText>;
  className?: string;
}

interface MapText {
  /** What the map is, for someone who cannot see it. */
  description: string;
  latestPosition: string;
  zoomIn: string;
  zoomOut: string;
  /** The letter for west on the grid: W, or V in Romanian. */
  west: string;
}

const ENGLISH_TEXT: MapText = {
  description: "Map of the crossing: planned route, track sailed so far and log entries",
  latestPosition: "Latest position",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  west: "W",
};

// Keyless dark basemap. Check Esri's terms for this site, or switch provider, before launch.
const TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTRIBUTION = "Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors";

const TRACK_COLOR = "hsl(184, 100%, 43%)";
/** The course ahead: a guess, so a colour of its own, apart from what was sailed and what was planned. */
const AHEAD_COLOR = "hsl(38, 95%, 62%)";
const GRID_STEP = 5;

const VoyageMap = ({
  planned,
  track,
  current,
  headingDeg,
  ahead = [],
  from,
  to,
  pins,
  boatEntryId,
  selectedId,
  focus,
  fitNonce,
  viewRef,
  onSelect,
  sea = null,
  describeSea,
  text,
  className,
}: VoyageMapProps) => {
  const words = { ...ENGLISH_TEXT, ...text };
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinMarkersRef = useRef<Record<string, L.Marker>>({});
  const boatMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const seaLayerRef = useRef<SeaLayer | null>(null);
  const describeSeaRef = useRef(describeSea);
  describeSeaRef.current = describeSea;
  /** True once the visitor has moved the map; after that it is not re-fitted behind their back. */
  const movedByUserRef = useRef(false);
  // Requests already acted on. A rebuilt map must not repeat the last one.
  const handledFocusRef = useRef(focus?.nonce ?? null);
  const handledFitRef = useRef(fitNonce);

  const fitRoute = (animate: boolean) => {
    mapRef.current?.fitBounds(
      L.latLngBounds([...planned, ...track, ...ahead.map((point) => point.pos)]),
      {
        padding: [44, 44],
        animate,
      }
    );
  };

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      // On phones a one-finger drag scrolls the page; two fingers move the map.
      dragging: !L.Browser.mobile,
      zoomSnap: 0.25,
      minZoom: 2,
      maxZoom: 10,
    });
    mapRef.current = map;
    seaLayerRef.current = createSeaLayer(
      map,
      (sample, forecast) => describeSeaRef.current?.(sample, forecast) ?? ""
    );
    map.attributionControl.setPrefix(false);
    L.control
      .zoom({ position: "bottomright", zoomInTitle: words.zoomIn, zoomOutTitle: words.zoomOut })
      .addTo(map);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 16 }).addTo(map);

    // Latitude / longitude grid, for the chart feel on an otherwise empty ocean.
    for (let lat = -20; lat <= 60; lat += GRID_STEP) {
      L.polyline(
        [
          [lat, -110],
          [lat, 30],
        ],
        { color: "#ffffff", weight: 1, opacity: lat % 10 === 0 ? 0.1 : 0.05, interactive: false }
      ).addTo(map);
    }
    for (let lon = -110; lon <= 30; lon += GRID_STEP) {
      L.polyline(
        [
          [-20, lon],
          [60, lon],
        ],
        { color: "#ffffff", weight: 1, opacity: lon % 10 === 0 ? 0.1 : 0.05, interactive: false }
      ).addTo(map);
    }

    const gridLabels = L.layerGroup().addTo(map);
    const drawGridLabels = () => {
      gridLabels.clearLayers();
      const bounds = map.getBounds();
      const step = map.getZoom() < 3.5 ? 10 : GRID_STEP;

      for (
        let lat = Math.ceil(bounds.getSouth() / step) * step;
        lat < bounds.getNorth();
        lat += step
      ) {
        L.marker([lat, bounds.getWest()], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "voyage-grat-label",
            html: `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}`,
            iconSize: [40, 14],
            iconAnchor: [-8, 16],
          }),
        }).addTo(gridLabels);
      }

      for (
        let lon = Math.ceil(bounds.getWest() / step) * step;
        lon < bounds.getEast();
        lon += step
      ) {
        L.marker([bounds.getSouth(), lon], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "voyage-grat-label voyage-grat-label--lon",
            html: `${Math.abs(lon)}°${lon > 0 ? "E" : words.west}`,
            iconSize: [40, 14],
            iconAnchor: [-4, 20],
          }),
        }).addTo(gridLabels);
      }
    };
    map.on("moveend zoomend", drawGridLabels);

    L.polyline(planned, {
      color: "#a9bbdd",
      weight: 1.5,
      opacity: 0.6,
      dashArray: "3 8",
      interactive: false,
    }).addTo(map);
    L.polyline(track, { color: TRACK_COLOR, weight: 10, opacity: 0.16, interactive: false }).addTo(
      map
    );
    L.polyline(track, {
      color: TRACK_COLOR,
      weight: 3,
      lineJoin: "round",
      interactive: false,
    }).addTo(map);

    if (current && ahead.length > 0) {
      L.polyline([current, ...ahead.map((point) => point.pos)], {
        color: AHEAD_COLOR,
        weight: 2,
        opacity: 0.9,
        interactive: false,
      }).addTo(map);
      ahead.forEach((point, index) => {
        const dot = L.circleMarker(point.pos, {
          radius: 3,
          color: AHEAD_COLOR,
          weight: 1.5,
          fillColor: "hsl(228, 39%, 8%)",
          fillOpacity: 1,
          interactive: false,
        });
        // Only the far end is labelled: with the whole ocean in view the dots are a
        // few pixels apart and their labels would lie on top of each other.
        if (index === ahead.length - 1) {
          // Leaflet treats a string as HTML, so hand it an element with plain text.
          const label = document.createElement("span");
          label.textContent = `+${point.hours} h`;
          dot.bindTooltip(label, {
            permanent: true,
            direction: "bottom",
            offset: [0, 4],
            className: "voyage-ahead-label",
          });
        }
        dot.addTo(map);
      });
    }

    // The eastern port sits near the right edge, under the legend. Its name goes to
    // the left of the dot, so a long one is neither covered nor cut off by the edge.
    const easternPort = from.pos[1] >= to.pos[1] ? from : to;

    [from, to].forEach((port) => {
      // Leaflet treats a string as HTML, so hand it an element with plain text.
      const label = document.createElement("span");
      label.textContent = port.name;
      const toTheLeft = port === easternPort;

      L.circleMarker(port.pos, {
        radius: 4.5,
        color: "#ffffff",
        weight: 1.5,
        fillColor: "hsl(228, 39%, 8%)",
        fillOpacity: 1,
        interactive: false,
      })
        .bindTooltip(label, {
          permanent: true,
          direction: toTheLeft ? "left" : "top",
          offset: toTheLeft ? [-8, 0] : [0, -14],
          className: "voyage-label",
        })
        .addTo(map);
    });

    // Leaflet lets a marker be reached with Tab but does nothing on Enter, so a
    // marker that opens an entry gets that itself. Its element only exists once the
    // map has a view, which is set further down: hence "add". Call before addTo().
    const openWithKeyboard = (marker: L.Marker, id: string) => {
      marker.on("add", () => {
        const element = marker.getElement();
        if (!element) {
          return;
        }
        // Lets the page find this entry's marker again after the map has been redrawn.
        element.dataset.entryId = id;
        element.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectRef.current(id);
          }
        });
      });
    };

    const pinMarkers: Record<string, L.Marker> = {};
    pins.forEach((pin) => {
      const marker = L.marker(pin.pos, {
        title: pin.title,
        riseOnHover: true,
        icon: L.divIcon({
          className: "voyage-pin",
          html: `<span>${pin.label}</span>`,
          iconSize: [22, 22],
          iconAnchor: [11 - (pin.offset?.[0] ?? 0), 11 - (pin.offset?.[1] ?? 0)],
        }),
      });
      marker.on("click", () => onSelectRef.current(pin.id));
      openWithKeyboard(marker, pin.id);
      marker.addTo(map);
      pinMarkers[pin.id] = marker;
    });
    pinMarkersRef.current = pinMarkers;

    if (current) {
      // An arrow when the heading is known, a plain dot when it is not.
      const glyph =
        headingDeg == null
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg>'
          : `<svg viewBox="0 0 24 24" style="transform: rotate(${Math.round(
              headingDeg
            )}deg)" aria-hidden="true"><path d="M12 2 19 21 12 17 5 21Z"/></svg>`;
      const boat = L.marker(current, {
        title: words.latestPosition,
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: "voyage-boat",
          html: `<span class="voyage-boat__pulse"></span><span class="voyage-boat__body">${glyph}</span>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      });
      if (boatEntryId) {
        boat.on("click", () => onSelectRef.current(boatEntryId));
        openWithKeyboard(boat, boatEntryId);
      }
      boat.addTo(map);
      boatMarkerRef.current = boat;
    }

    const kept = viewRef?.current;
    if (kept) {
      movedByUserRef.current = true;
      map.setView(kept.center, kept.zoom, { animate: false });
    } else {
      fitRoute(false);
    }
    drawGridLabels();
    map.on("moveend", () => {
      if (viewRef && movedByUserRef.current) {
        const centre = map.getCenter();
        viewRef.current = { center: [centre.lat, centre.lng], zoom: map.getZoom() };
      }
    });

    const container = containerRef.current;
    const markMoved = () => {
      movedByUserRef.current = true;
    };
    ["pointerdown", "wheel", "keydown"].forEach((type) =>
      container.addEventListener(type, markMoved, { passive: true })
    );

    // The container can get its real size after mount (or change it when a phone is
    // turned). Keep Leaflet in step, and keep the whole route in view until the
    // visitor has moved the map themselves.
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
      if (!movedByUserRef.current) {
        fitRoute(false);
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      ["pointerdown", "wheel", "keydown"].forEach((type) =>
        container.removeEventListener(type, markMoved)
      );
      seaLayerRef.current?.remove();
      seaLayerRef.current = null;
      map.remove();
      mapRef.current = null;
      pinMarkersRef.current = {};
      boatMarkerRef.current = null;
    };
    // Built once per mount. The page gives the map a new `key` when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After the effect that builds the map, so a rebuilt map gets the waves back.
  const seaForecast = sea?.forecast ?? null;
  const seaStep = sea?.step ?? 0;
  useEffect(() => {
    if (seaForecast) {
      seaLayerRef.current?.show(seaForecast, seaStep);
    } else {
      seaLayerRef.current?.hide();
    }
  }, [seaForecast, seaStep]);

  useEffect(() => {
    Object.entries(pinMarkersRef.current).forEach(([id, marker]) => {
      marker.getElement()?.classList.toggle("is-active", id === selectedId);
    });
    boatMarkerRef.current
      ?.getElement()
      ?.classList.toggle("is-active", Boolean(boatEntryId) && selectedId === boatEntryId);
  }, [selectedId, boatEntryId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || focus.nonce === handledFocusRef.current) {
      return;
    }
    handledFocusRef.current = focus.nonce;

    const target =
      focus.id === boatEntryId ? current : pins.find((pin) => pin.id === focus.id)?.pos;
    if (target) {
      movedByUserRef.current = true;
      map.flyTo(target, Math.max(map.getZoom(), 5.5), { duration: 0.9 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => {
    if (fitNonce !== handledFitRef.current) {
      handledFitRef.current = fitNonce;
      movedByUserRef.current = false;
      if (viewRef) {
        viewRef.current = null;
      }
      fitRoute(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  return (
    <div
      ref={containerRef}
      className={cn("voyage-map h-full w-full", className)}
      role="application"
      aria-label={words.description}
    />
  );
};

export default VoyageMap;
