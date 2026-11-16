import L from "leaflet";
import {
  arrowStride,
  paintSea,
  sampleSea,
  scaleTop,
  seaArrows,
  seaBounds,
  type SeaForecast,
  type SeaSample,
} from "@/lib/seaField";

/**
 * A forecast (waves or wind) as a layer of the voyage map: a picture laid over
 * the ocean in the layer's colours, arrows for the way the waves run or the
 * wind blows, and the figures for a spot when it is clicked. It sits above the
 * map tiles and below the route, the track and the pins.
 */

/** How finely the picture is painted: pixels per grid step. The browser smooths it when it is stretched. */
const PIXELS_PER_STEP = 14;
/** Arrows are drawn for the part of the map in view and this much around it. */
const VIEW_MARGIN = 0.15;
/** A click this close to the top of the map gets its figures below it, where there is room. */
const ROOM_ABOVE_PX = 120;

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/**
 * Each time step of a forecast is painted once and kept for as long as the
 * forecast is: going back to a step, switching the layer off and on, or the map
 * being rebuilt costs nothing.
 */
const painted = new WeakMap<SeaForecast, Map<number, string>>();
/**
 * The spot whose figures are shown. Kept here so that it outlives a rebuilt map
 * and a change from one forecast to the other.
 */
let readoutAt: { lat: number; lng: number } | null = null;

/** For when the visitor switches the forecasts off: the next one starts with no spot picked. */
export const forgetSeaSpot = () => {
  readoutAt = null;
};

const paint = (forecast: SeaForecast, step: number): string | null => {
  let steps = painted.get(forecast);
  if (!steps) {
    steps = new Map();
    painted.set(forecast, steps);
  }
  const ready = steps.get(step);
  if (ready) {
    return ready;
  }
  const { south, west, north, east } = seaBounds(forecast);
  const width = Math.max(2, (forecast.cols - 1) * PIXELS_PER_STEP);
  const height = Math.max(
    2,
    Math.round((width * (mercatorY(north) - mercatorY(south))) / (((east - west) * Math.PI) / 180))
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const pixels = context.createImageData(width, height);
  pixels.data.set(paintSea(forecast, step, width, height));
  context.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL("image/png");
  steps.set(step, url);
  return url;
};

export interface SeaLayer {
  /** Draw this time step of the forecast, or change to it. */
  show: (forecast: SeaForecast, step: number) => void;
  hide: () => void;
  /** Take everything off the map, for good. */
  remove: () => void;
}

export const createSeaLayer = (
  map: L.Map,
  /** The figures for a spot, in words, in the page's language. */
  describe: (sample: SeaSample, forecast: SeaForecast) => string
): SeaLayer => {
  const fieldPane = map.createPane("voyage-sea");
  fieldPane.style.zIndex = "350";
  fieldPane.style.pointerEvents = "none";
  const arrowPane = map.createPane("voyage-sea-arrows");
  arrowPane.style.zIndex = "360";
  arrowPane.style.pointerEvents = "none";

  const arrows = L.layerGroup();
  const readout = L.tooltip({
    permanent: true,
    direction: "top",
    offset: [0, -6],
    className: "voyage-sea-readout",
  });
  let picture: L.ImageOverlay | null = null;
  let shown: { forecast: SeaForecast; step: number } | null = null;

  const drawArrows = () => {
    arrows.clearLayers();
    if (!shown) {
      return;
    }
    const { forecast, step } = shown;
    const view = map.getBounds().pad(VIEW_MARGIN);
    const top = scaleTop(forecast.layer);
    for (const arrow of seaArrows(forecast, step, arrowStride(forecast.step, map.getZoom()))) {
      if (!view.contains(arrow.pos)) {
        continue;
      }
      // Longer arrows for more of it, within reason.
      const size = Math.round(11 + Math.min(9, (arrow.value / top) * 40));
      const shaft = "M12 21V4M6.5 9.5 12 4l5.5 5.5";
      L.marker(arrow.pos, {
        pane: "voyage-sea-arrows",
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "voyage-sea-arrow",
          // Drawn twice, dark under light, so it reads on any of the scale's colours.
          html: `<svg viewBox="0 0 24 24" style="transform: rotate(${Math.round(
            arrow.towardDeg
          )}deg)" aria-hidden="true"><path class="voyage-sea-arrow__edge" d="${shaft}"/><path d="${shaft}"/></svg>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
      }).addTo(arrows);
    }
  };

  const writeReadout = () => {
    if (!shown || !readoutAt) {
      return;
    }
    const sample = sampleSea(shown.forecast, shown.step, readoutAt.lat, readoutAt.lng);
    if (!sample) {
      readout.remove();
      readoutAt = null;
      return;
    }
    // Leaflet treats a string as HTML, so hand it an element with plain text.
    const text = document.createElement("span");
    text.textContent = describe(sample, shown.forecast);
    const below = map.latLngToContainerPoint(readoutAt).y < ROOM_ABOVE_PX;
    readout.options.direction = below ? "bottom" : "top";
    readout.options.offset = L.point(0, below ? 6 : -6);
    readout.setLatLng(readoutAt).setContent(text);
    if (!map.hasLayer(readout)) {
      readout.addTo(map);
    }
  };

  const onClick = (event: L.LeafletMouseEvent) => {
    if (!shown) {
      return;
    }
    readoutAt = { lat: event.latlng.lat, lng: event.latlng.lng };
    writeReadout();
  };

  // Also fires at the end of a zoom.
  map.on("moveend", drawArrows);
  map.on("click", onClick);

  /** Off the map, but the spot being read is remembered for when the layer comes back. */
  const clear = () => {
    shown = null;
    readout.remove();
    arrows.clearLayers();
    arrows.remove();
    picture?.remove();
  };

  return {
    show: (forecast, step) => {
      const url = step >= 0 && step < forecast.times.length ? paint(forecast, step) : null;
      if (!url) {
        clear();
        return;
      }
      const { south, west, north, east } = seaBounds(forecast);
      const box = L.latLngBounds([south, west], [north, east]);
      if (picture) {
        picture.setUrl(url);
        picture.setBounds(box);
      } else {
        picture = L.imageOverlay(url, box, {
          pane: "voyage-sea",
          interactive: false,
          className: "voyage-sea-field",
        });
      }
      if (!map.hasLayer(picture)) {
        picture.addTo(map);
      }
      shown = { forecast, step };
      if (!map.hasLayer(arrows)) {
        arrows.addTo(map);
      }
      drawArrows();
      writeReadout();
    },
    hide: clear,
    remove: () => {
      clear();
      map.off("moveend", drawArrows);
      map.off("click", onClick);
      picture = null;
    },
  };
};
