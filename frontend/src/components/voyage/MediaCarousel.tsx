import { useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { photoUrl, videoUrl, type VoyagePhotoRef } from "@/lib/voyageApi";
import { cn } from "@/lib/utils";

export interface MediaLabels {
  previous: string;
  next: string;
  video: string;
  fullQuality: string;
  counter: (index: number, total: number) => string;
  open: (index: number, total: number) => string;
}

interface MediaCarouselProps {
  items: VoyagePhotoRef[];
  labels: MediaLabels;
  /** Which one is shown. Left out, the carousel keeps count itself, from `startAt`. */
  index?: number;
  onIndex?: (index: number) => void;
  startAt?: number;
  /** A photo that is pressed (to see it large). Videos play where they are. */
  onOpen?: (index: number) => void;
  /** The size and fit of the photo or video itself. */
  mediaClassName: string;
  /** Offer the larger version of a photo that was sent at full quality. */
  fullQuality?: boolean;
  lazy?: boolean;
  className?: string;
}

const SWIPE_PX = 40;

/**
 * The photos and videos of one log entry, one at a time, with previous and
 * next. A swipe does the same on a phone.
 */
const MediaCarousel = ({
  items,
  labels,
  index,
  onIndex,
  startAt = 0,
  onOpen,
  mediaClassName,
  fullQuality = false,
  lazy = false,
  className,
}: MediaCarouselProps) => {
  const [own, setOwn] = useState(startAt);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const total = items.length;
  if (total === 0) {
    return null;
  }
  const at = Math.min(Math.max(index ?? own, 0), total - 1);
  const current = items[at];
  const following = items[(at + 1) % total];

  const go = (step: number) => {
    const target = (at + step + total) % total;
    setOwn(target);
    onIndex?.(target);
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch || total < 2) {
      return;
    }
    const across = touch.clientX - start.x;
    // A swipe, not a scroll of the page that drifted sideways.
    if (Math.abs(across) >= SWIPE_PX && Math.abs(across) > 2 * Math.abs(touch.clientY - start.y)) {
      go(across < 0 ? 1 : -1);
    }
  };

  const picture =
    current.kind === "video" ? null : (
      <img
        key={current.id}
        src={photoUrl(current.id)}
        alt=""
        width={current.w}
        height={current.h}
        loading={lazy ? "lazy" : undefined}
        className={cn("w-full", mediaClassName)}
      />
    );
  const arrow =
    "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <div
      className={cn("relative overflow-hidden bg-black", className)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {current.kind === "video" ? (
        <video
          key={current.id}
          controls
          playsInline
          preload={current.poster ? "none" : "metadata"}
          poster={current.poster ? photoUrl(current.poster) : undefined}
          aria-label={labels.video}
          className={cn("w-full bg-black object-contain", mediaClassName)}
        >
          <source src={videoUrl(current.id)} />
        </video>
      ) : onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(at)}
          aria-label={labels.open(at + 1, total)}
          className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {picture}
        </button>
      ) : (
        picture
      )}

      {/* The next photo is fetched ahead, so stepping on does not show an empty frame. */}
      {total > 1 && following.kind !== "video" && !lazy ? (
        <img src={photoUrl(following.id)} alt="" className="hidden" />
      ) : null}

      {total > 1 ? (
        <>
          <button type="button" onClick={() => go(-1)} aria-label={labels.previous} className={cn(arrow, "left-2")}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label={labels.next} className={cn(arrow, "right-2")}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <span
            aria-live="polite"
            className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
          >
            {labels.counter(at + 1, total)}
          </span>
        </>
      ) : null}

      {fullQuality && current.kind !== "video" && current.max ? (
        <a
          href={photoUrl(current.id, "max")}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Maximize2 className="h-3 w-3" />
          {labels.fullQuality}
        </a>
      ) : null}
    </div>
  );
};

export default MediaCarousel;
