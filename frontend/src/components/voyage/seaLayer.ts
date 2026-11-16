import L from "leaflet";
import type { LatLon } from "@/lib/geo";
import {
  arrowStride,
  paintSea,
  sampleSea,
  seaArrows,
  seaBounds,
  type SeaForecast,
  type SeaSample,
} from "@/lib/seaField";

/**
 * The wave forecast as a layer of the voyage map: a picture of the wave height
 * laid over the ocean, arrows for the way the waves run, and the figures for a
 * spot when the sea is clicked. It sits above the map tiles and below the
 * route, the track and the pins.
 */

/** How finely the picture is painted: pixels per grid step. The browser smooths it when it is stretched. */
const PIXELS_PER_STEP = 14;

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

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
  describe: (sample: SeaSample, pos: LatLon) => string
): SeaLayer => {
  const fieldPane = map.createPane("voyage-sea");
  fieldPane.style.zIndex = "350";
  fieldPane.style.pointerEvents = "none";
  const arrowPane = map.createPane("voyage-sea-arrows");
  arrowPane.style.zIndex = "360";
  arrowPane.style.pointerEvents = "none";

  const canvas = document.createElement("canvas");
  const arrows = L.layerGroup();
  const readout = L.tooltip({
    permanent: true,
    direction: "top",
    offset: [0, -6],
    className: "voyage-sea-readout",
  });
  let picture: L.ImageOverlay | null = null;
  let shown: { forecast: SeaForecast; step: number } | null = null;
  let readoutAt: L.LatLng | null = null;
  /** Each time step is painted once; going back to it costs nothing. */
  let painted = new Map<number, string>();

  const paint = (forecast: SeaForecast, step: number): string | null => {
    const ready = painted.get(step);
    if (ready) {
      return ready;
    }
    const { south, west, north, east } = seaBounds(forecast);
    const width = Math.max(2, (forecast.cols - 1) * PIXELS_PER_STEP);
    const height = Math.max(
      2,
      Math.round((width * (mercatorY(north) - mercatorY(south))) / (((east - west) * Math.PI) / 180))
    );
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
    painted.set(step, url);
    return url;
  };

  const drawArrows = () => {
    arrows.clearLayers();
    if (!shown) {
      return;
    }
    const stride = arrowStride(shown.forecast.step, map.getZoom());
    for (const arrow of seaArrows(shown.forecast, shown.step, stride)) {
      // Longer arrows for higher waves, within reason.
      const size = Math.round(13 + Math.min(9, arrow.heightM * 2.2));
      L.marker(arrow.pos, {
        pane: "voyage-sea-arrows",
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "voyage-sea-arrow",
          html: `<svg viewBox="0 0 24 24" style="transform: rotate(${Math.round(
            arrow.towardDeg
          )}deg)" aria-hidden="true"><path d="M12 21V4M6.5 9.5 12 4l5.5 5.5"/></svg>`,
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
    text.textContent = describe(sample, [readoutAt.lat, readoutAt.lng]);
    readout.setLatLng(readoutAt).setContent(text);
    if (!map.hasLayer(readout)) {
      readout.addTo(map);
    }
  };

  const onClick = (event: L.LeafletMouseEvent) => {
    if (!shown) {
      return;
    }
    readoutAt = event.latlng;
    writeReadout();
  };

  map.on("zoomend", drawArrows);
  map.on("click", onClick);

  const hide = () => {
    shown = null;
    readoutAt = null;
    readout.remove();
    arrows.clearLayers();
    arrows.remove();
    picture?.remove();
  };

  return {
    show: (forecast, step) => {
      if (step < 0 || step >= forecast.times.length) {
        hide();
        return;
      }
      if (!shown || shown.forecast !== forecast) {
        painted = new Map();
      }
      const url = paint(forecast, step);
      if (!url) {
        hide();
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
    hide,
    remove: () => {
      hide();
      map.off("zoomend", drawArrows);
      map.off("click", onClick);
      picture = null;
    },
  };
};
