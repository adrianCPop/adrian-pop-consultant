import { ChevronLeft, ChevronRight, Loader2, Waves } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { HEIGHT_SCALE } from "@/lib/seaField";
import { useVoyageTexts } from "@/lib/useVoyageTexts";
import { cn } from "@/lib/utils";

/** Within this long of the present, a time step counts as "now". */
const NOW_MS = 3 * 3_600_000;

const TOP_OF_SCALE = HEIGHT_SCALE[HEIGHT_SCALE.length - 1].metres;
const SCALE_GRADIENT = `linear-gradient(to right, ${HEIGHT_SCALE.map(
  (mark) => `rgb(${mark.rgb.join(" ")}) ${(mark.metres / TOP_OF_SCALE) * 100}%`
).join(", ")})`;
const SCALE_MARKS = [0, 1, 2, 3, 4, 5, 7, TOP_OF_SCALE];

export type SeaState = "idle" | "loading" | "failed" | "ready";

interface SeaControlsProps {
  on: boolean;
  onToggle: (on: boolean) => void;
  state: SeaState;
  /** The forecast's time steps, UTC. */
  times: string[];
  step: number;
  onStep: (step: number) => void;
  /** The present moment by the server's clock, in ms. */
  now: number;
  className?: string;
}

/**
 * The switch for the wave forecast on the map and, while it is on, the time it
 * is shown for and what its colours mean.
 */
const SeaControls = ({ on, onToggle, state, times, step, onStep, now, className }: SeaControlsProps) => {
  const texts = useVoyageTexts();
  const { t, rich } = texts;
  const ready = on && state === "ready" && times.length > 0;
  const moment = ready ? Date.parse(times[Math.min(step, times.length - 1)]) : 0;
  const away = moment - now;
  const relative =
    Math.abs(away) < NOW_MS
      ? t("public.sea.now")
      : away > 0
        ? t("public.sea.ahead", { span: texts.span(away) })
        : t("public.sea.ago", { span: texts.span(-away) });
  const stepButton =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

  return (
    <section
      aria-label={t("public.sea.label")}
      className={cn("panel-soft rounded-2xl px-4 py-3 sm:px-5", className)}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2.5">
          <Switch id="sea-on" checked={on} onCheckedChange={onToggle} />
          <Label
            htmlFor="sea-on"
            className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            <Waves className="h-4 w-4 text-primary" />
            {t("public.sea.toggle")}
          </Label>
        </div>

        {on && state === "loading" ? (
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("public.sea.loading")}
          </p>
        ) : null}
        {on && state === "failed" ? (
          <p className="text-xs text-amber-200" role="status">
            {t("public.sea.failed")}
          </p>
        ) : null}

        {ready ? (
          <>
            <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
              <button
                type="button"
                className={stepButton}
                aria-label={t("public.sea.earlier")}
                disabled={step <= 0}
                onClick={() => onStep(step - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={times.length - 1}
                step={1}
                value={step}
                onChange={(event) => onStep(Number(event.target.value))}
                aria-label={t("public.sea.time")}
                aria-valuetext={`${texts.dayTime(moment)}, ${relative}`}
                className="h-2 min-w-0 flex-1 cursor-pointer accent-[hsl(var(--primary))]"
              />
              <button
                type="button"
                className={stepButton}
                aria-label={t("public.sea.later")}
                disabled={step >= times.length - 1}
                onClick={() => onStep(step + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm tabular-nums">
              <span className="font-semibold text-foreground">{texts.dayTime(moment)}</span>
              <span className="text-muted-foreground"> · {relative}</span>
            </p>
          </>
        ) : null}
      </div>

      {ready ? (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="max-w-md">
            <div
              role="img"
              aria-label={t("public.sea.legend")}
              className="h-2 rounded-full"
              style={{ background: SCALE_GRADIENT }}
            />
            <div className="relative mt-1 h-4 text-[0.68rem] tabular-nums text-muted-foreground" aria-hidden="true">
              {SCALE_MARKS.map((metres) => (
                <span
                  key={metres}
                  className={cn(
                    "absolute whitespace-nowrap",
                    metres === 0 ? "" : metres === TOP_OF_SCALE ? "-translate-x-full" : "-translate-x-1/2"
                  )}
                  style={{ left: `${(metres / TOP_OF_SCALE) * 100}%` }}
                >
                  {metres === TOP_OF_SCALE
                    ? `${t("unit.metres", { value: texts.number(metres) })}+`
                    : texts.number(metres)}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
            {t("public.sea.note")}{" "}
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
