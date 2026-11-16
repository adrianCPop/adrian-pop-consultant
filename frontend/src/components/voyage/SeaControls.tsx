import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2, Waves, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scaleTop, SEA_SCALES, type SeaLayerName } from "@/lib/seaField";
import { useVoyageTexts } from "@/lib/useVoyageTexts";
import { cn } from "@/lib/utils";

/** Within this long of the present, a time step counts as "now". */
const NOW_MS = 3 * 3_600_000;
const HOUR_MS = 3_600_000;

/** The figures written under each colour scale. */
const SCALE_MARKS: Record<SeaLayerName, number[]> = {
  waves: [0, 1, 2, 3, 4, 5, 7, 9],
  wind: [0, 10, 20, 30, 40, 50, 64],
};

const gradient = (layer: SeaLayerName) =>
  `linear-gradient(to right, ${SEA_SCALES[layer]
    .map((mark) => `rgb(${mark.rgb.join(" ")}) ${(mark.at / scaleTop(layer)) * 100}%`)
    .join(", ")})`;

/** `waiting`: the server has said the forecast is on its way and when to ask again. */
export type SeaState = "idle" | "loading" | "waiting" | "failed" | "ready";

interface SeaControlsProps {
  /** Which forecast is on the map; null for none. */
  layer: SeaLayerName | null;
  onLayer: (layer: SeaLayerName | null) => void;
  /** How the chosen forecast stands. */
  state: SeaState;
  onRetry: () => void;
  /** The chosen forecast's time steps, UTC. */
  times: string[];
  step: number;
  onStep: (step: number) => void;
  /** The present moment by the server's clock, in ms. */
  now: number;
  /** The forecast in words, for the time shown: at the boat, the most anywhere. */
  summary: string[];
  className?: string;
}

/**
 * Which forecast is laid over the map (none, waves, wind) and, while one is,
 * the time it is shown for, what its colours mean, and its figures in words.
 */
const SeaControls = ({
  layer,
  onLayer,
  state,
  onRetry,
  times,
  step,
  onStep,
  now,
  summary,
  className,
}: SeaControlsProps) => {
  const texts = useVoyageTexts();
  const { t, rich } = texts;
  const ready = layer !== null && state === "ready" && times.length > 0;
  const last = times.length - 1;
  const moment = ready ? Date.parse(times[Math.min(step, last)]) : 0;
  // To the hour: this is read out as the slider's value, and must not change every minute.
  const away = Math.round((moment - now) / HOUR_MS) * HOUR_MS;
  const relative =
    Math.abs(moment - now) < NOW_MS
      ? t("public.sea.now")
      : away > 0
        ? t("public.sea.ahead", { span: texts.span(away) })
        : t("public.sea.ago", { span: texts.span(-away) });
  const busy = layer !== null && (state === "loading" || state === "waiting");
  const status =
    layer === null
      ? ""
      : state === "loading"
        ? t("public.sea.loading")
        : state === "waiting"
          ? t("public.sea.waiting")
          : state === "failed"
            ? t("public.sea.failed")
            : "";

  const choice = (value: SeaLayerName | null, label: string, icon?: ReactNode) => (
    <button
      key={value ?? "off"}
      type="button"
      aria-pressed={layer === value}
      onClick={() => onLayer(value)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        layer === value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
  // Marked as unavailable rather than disabled, so the button keeps the focus at either end.
  const stepButton = (available: boolean) =>
    cn(
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 text-muted-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      available ? "hover:text-foreground" : "cursor-default opacity-40"
    );

  return (
    <section
      aria-label={t("public.sea.label")}
      className={cn("panel-soft rounded-2xl px-4 py-3 sm:px-5", className)}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div
          role="group"
          aria-label={t("public.sea.label")}
          className="inline-flex shrink-0 items-center rounded-lg border border-border/80 bg-secondary/40 p-0.5"
        >
          {choice(null, t("public.sea.off"))}
          {choice("waves", t("public.sea.waves"), <Waves className="h-3.5 w-3.5" />)}
          {choice("wind", t("public.sea.wind"), <Wind className="h-3.5 w-3.5" />)}
        </div>

        {/* Always there, so that what is written into it is announced. */}
        <p
          role="status"
          className={cn(
            "inline-flex items-center gap-2 text-xs",
            state === "failed" ? "text-amber-200" : "text-muted-foreground",
            status === "" && "sr-only"
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
          {status}
        </p>
        {layer !== null && state === "failed" ? (
          <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={onRetry}>
            {t("public.tryAgain")}
          </Button>
        ) : null}

        {ready ? (
          <>
            <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
              <button
                type="button"
                className={stepButton(step > 0)}
                aria-label={t("public.sea.earlier")}
                aria-disabled={step <= 0}
                onClick={() => step > 0 && onStep(step - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={last}
                step={1}
                value={Math.min(step, last)}
                onChange={(event) => onStep(Number(event.target.value))}
                aria-label={t("public.sea.time")}
                aria-valuetext={`${texts.dayTime(moment)}, ${relative}`}
                className="h-9 min-w-0 flex-1 cursor-pointer accent-[hsl(var(--primary))]"
              />
              <button
                type="button"
                className={stepButton(step < last)}
                aria-label={t("public.sea.later")}
                aria-disabled={step >= last}
                onClick={() => step < last && onStep(step + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {/* Read out when the two buttons change it; the slider reads its own value. */}
            <p className="text-sm tabular-nums" aria-live="polite" aria-atomic="true">
              <span className="font-semibold text-foreground">{texts.dayTime(moment)}</span>
              <span className="text-muted-foreground"> · {relative}</span>
            </p>
          </>
        ) : null}
      </div>

      {ready && layer ? (
        <div className="mt-3 border-t border-border/60 pt-3">
          {summary.length > 0 ? (
            <p className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums text-foreground">
              {summary.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
          ) : null}
          <div className="max-w-md">
            <div
              role="img"
              aria-label={t(layer === "waves" ? "public.sea.wavesScale" : "public.sea.windScale")}
              className="h-2 rounded-full"
              style={{ background: gradient(layer) }}
            />
            <div
              className="relative mt-1 h-4 text-[0.68rem] tabular-nums text-muted-foreground"
              aria-hidden="true"
            >
              {SCALE_MARKS[layer].map((mark) => {
                const top = mark === scaleTop(layer);
                const figure = texts.number(mark);
                return (
                  <span
                    key={mark}
                    className={cn(
                      "absolute whitespace-nowrap",
                      mark === 0 ? "" : top ? "-translate-x-full" : "-translate-x-1/2"
                    )}
                    style={{ left: `${(mark / scaleTop(layer)) * 100}%` }}
                  >
                    {top
                      ? `${t(layer === "waves" ? "unit.metres" : "unit.knots", { value: figure })}+`
                      : figure}
                  </span>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
            {t(layer === "waves" ? "public.sea.wavesNote" : "public.sea.windNote")}{" "}
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
      ) : null}
    </section>
  );
};

export default SeaControls;
