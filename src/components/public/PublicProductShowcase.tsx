"use client";

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Pause,
  Play,
  X,
} from "lucide-react";
import { useReducedMotion } from "framer-motion";
import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export interface PublicShowcaseImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface PublicShowcaseThemeImages {
  light: readonly PublicShowcaseImage[];
  dark: readonly PublicShowcaseImage[];
}

export interface PublicShowcaseYoutubeVideo {
  /** Accepts a YouTube video ID or a youtube.com/youtu.be URL. */
  source: string;
  title: string;
}

interface PublicProductShowcaseBaseProps {
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
  frameClassName?: string;
  /** Keeps the accessible title while omitting the visible heading in embedded contexts. */
  hideHeader?: boolean;
}

interface PublicProductScreenshotShowcaseProps
  extends PublicProductShowcaseBaseProps {
  variant?: "screenshots";
  images: PublicShowcaseThemeImages;
  video?: never;
  /** Set to 0 to disable automatic rotation. Values below 3 seconds are clamped. */
  autoplayIntervalMs?: number;
  /** Prioritizes the first visible screenshot when the showcase is above the fold. */
  priority?: boolean;
}

interface PublicProductVideoShowcaseProps
  extends PublicProductShowcaseBaseProps {
  variant: "youtube";
  video: PublicShowcaseYoutubeVideo;
  images?: never;
  autoplayIntervalMs?: never;
}

export type PublicProductShowcaseProps =
  | PublicProductScreenshotShowcaseProps
  | PublicProductVideoShowcaseProps;

const MINIMUM_AUTOPLAY_INTERVAL_MS = 3_000;
const DEFAULT_AUTOPLAY_INTERVAL_MS = 6_500;
const SWIPE_THRESHOLD_PX = 48;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function getYoutubeVideoId(source: string) {
  const normalizedSource = source.trim();

  if (YOUTUBE_ID_PATTERN.test(normalizedSource)) {
    return normalizedSource;
  }

  try {
    const url = new URL(normalizedSource);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    let candidate: string | null = null;

    if (hostname === "youtu.be") {
      candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com"
    ) {
      candidate = url.searchParams.get("v");

      if (!candidate) {
        const pathParts = url.pathname.split("/").filter(Boolean);
        const embedIndex = pathParts.findIndex((part) =>
          ["embed", "shorts", "live"].includes(part),
        );
        candidate = embedIndex >= 0 ? pathParts[embedIndex + 1] ?? null : null;
      }
    }

    return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function ShowcaseHeader({
  eyebrow,
  title,
  description,
  titleId,
}: Pick<
  PublicProductShowcaseBaseProps,
  "eyebrow" | "title" | "description"
> & {
  titleId: string;
}) {
  return (
    <header className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
      {eyebrow ? (
        <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={titleId}
        className={cn(
          "text-balance text-3xl font-black leading-[1.04] tracking-tight md:text-5xl",
          eyebrow && "mt-4",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}

function ShowcaseFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "public-glass-surface mx-auto overflow-hidden rounded-[28px] p-2 md:rounded-[32px] md:p-3",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[21px] border border-border/50 bg-card shadow-[inset_0_1px_0_hsl(var(--foreground)/0.055)] dark:border-white/[0.08] dark:bg-zinc-950 md:rounded-[23px]">
        {children}
      </div>
    </div>
  );
}

function YoutubeShowcase({
  title,
  eyebrow,
  description,
  className,
  frameClassName,
  hideHeader = false,
  video,
}: PublicProductVideoShowcaseProps) {
  const titleId = useId();
  const videoId = useMemo(() => getYoutubeVideoId(video.source), [video.source]);

  return (
    <section
      aria-labelledby={titleId}
      className={cn("public-section-stage px-5 py-16 md:px-8 md:py-20", className)}
    >
      <div className="mx-auto max-w-[1240px]">
        {hideHeader ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : (
          <ShowcaseHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
            titleId={titleId}
          />
        )}

        <ShowcaseFrame className={frameClassName}>
          <div className="border-b border-border/45 bg-background/80 px-4 py-3 dark:border-white/[0.07] dark:bg-zinc-950/82 md:px-5">
            <p className="truncate text-xs font-bold text-foreground/78 md:text-sm">
              {video.title}
            </p>
          </div>
          <div className="relative aspect-video bg-zinc-950">
            {videoId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
                title={video.title}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-zinc-300">
                O vídeo não está disponível no momento.
              </div>
            )}
          </div>
        </ShowcaseFrame>
      </div>
    </section>
  );
}

function ScreenshotShowcase({
  title,
  eyebrow,
  description,
  className,
  frameClassName,
  hideHeader = false,
  images,
  autoplayIntervalMs = DEFAULT_AUTOPLAY_INTERVAL_MS,
  priority = false,
}: PublicProductScreenshotShowcaseProps) {
  const titleId = useId();
  const carouselId = useId();
  const { theme } = useTheme();
  const prefersReducedMotion = useReducedMotion() ?? true;
  const activeTheme = theme === "light" ? "light" : "dark";
  const slides = images[activeTheme];
  const slideCount = slides.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [shouldAnimateTrack, setShouldAnimateTrack] = useState(true);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const pointerStartRef = useRef<{ id: number; x: number } | null>(null);
  const suppressLightboxOpenRef = useRef(false);
  const indicatorTrackRef = useRef<HTMLDivElement | null>(null);
  const indicatorRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const safeActiveIndex = slideCount > 0
    ? Math.min(activeIndex, slideCount - 1)
    : 0;
  const activeSlide = slides[safeActiveIndex];
  const supportsAutoplay =
    slideCount > 1 && autoplayIntervalMs > 0 && !prefersReducedMotion;
  const interactionPaused =
    isHovered
    || hasFocusWithin
    || isLightboxOpen
    || !isInViewport
    || !isDocumentVisible;

  const showNext = useCallback(() => {
    if (slideCount === 0) return;
    const nextIndex = (safeActiveIndex + 1) % slideCount;
    setShouldAnimateTrack(nextIndex === safeActiveIndex + 1);
    setActiveIndex(nextIndex);
  }, [safeActiveIndex, slideCount]);

  const showPrevious = useCallback(() => {
    if (slideCount === 0) return;
    const previousIndex = (safeActiveIndex - 1 + slideCount) % slideCount;
    setShouldAnimateTrack(previousIndex === safeActiveIndex - 1);
    setActiveIndex(previousIndex);
  }, [safeActiveIndex, slideCount]);

  const showSlide = useCallback(
    (index: number) => {
      if (slideCount === 0) return;
      const nextIndex = Math.min(Math.max(index, 0), slideCount - 1);
      setShouldAnimateTrack(Math.abs(nextIndex - safeActiveIndex) === 1);
      setActiveIndex(nextIndex);
    },
    [safeActiveIndex, slideCount],
  );

  useEffect(() => {
    setShouldAnimateTrack(false);
    setActiveIndex(0);
  }, [activeTheme]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setIsInViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsInViewport(entry.isIntersecting),
      { rootMargin: "200px 0px", threshold: 0.01 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState !== "hidden");
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (
      !supportsAutoplay ||
      isManuallyPaused ||
      interactionPaused
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(
      showNext,
      Math.max(autoplayIntervalMs, MINIMUM_AUTOPLAY_INTERVAL_MS),
    );

    return () => window.clearInterval(intervalId);
  }, [
    autoplayIntervalMs,
    interactionPaused,
    isManuallyPaused,
    showNext,
    supportsAutoplay,
  ]);

  useEffect(() => {
    const indicatorTrack = indicatorTrackRef.current;
    const activeIndicator = indicatorRefs.current[safeActiveIndex];
    if (!indicatorTrack || !activeIndicator) return;

    const centeredOffset =
      activeIndicator.offsetLeft -
      (indicatorTrack.clientWidth - activeIndicator.clientWidth) / 2;
    const nextScrollPosition = Math.max(0, centeredOffset);

    if (typeof indicatorTrack.scrollTo === "function") {
      indicatorTrack.scrollTo({
        left: nextScrollPosition,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
      return;
    }

    indicatorTrack.scrollLeft = nextScrollPosition;
  }, [prefersReducedMotion, safeActiveIndex]);

  const handleFocusCapture = () => setHasFocusWithin(true);

  const handleBlurCapture = (event: FocusEvent<HTMLElement>) => {
    const nextFocusedElement = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextFocusedElement)) {
      setHasFocusWithin(false);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressLightboxOpenRef.current = false;
    pointerStartRef.current = { id: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const clearPointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerStartRef.current = null;
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const pointerStart = pointerStartRef.current;
    if (!pointerStart || pointerStart.id !== event.pointerId) return;

    const distance = event.clientX - pointerStart.x;
    clearPointer(event);

    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
    suppressLightboxOpenRef.current = true;
    if (distance < 0) showNext();
    else showPrevious();
  };

  const handleImageClick = () => {
    if (suppressLightboxOpenRef.current) {
      suppressLightboxOpenRef.current = false;
      return;
    }

    setIsLightboxOpen(true);
  };

  const handleLightboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" && slideCount > 1) {
      event.preventDefault();
      showPrevious();
    }

    if (event.key === "ArrowRight" && slideCount > 1) {
      event.preventDefault();
      showNext();
    }
  };

  if (slideCount === 0) return null;

  return (
    <section
      ref={sectionRef}
      aria-labelledby={titleId}
      className={cn("public-section-stage px-5 py-16 md:px-8 md:py-20", className)}
    >
      <div className="mx-auto max-w-[1240px]">
        {hideHeader ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : (
          <ShowcaseHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
            titleId={titleId}
          />
        )}

        <ShowcaseFrame className={frameClassName}>
          <div
              id={carouselId}
              role="region"
              aria-roledescription="carrossel"
              aria-label={title}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onFocusCapture={handleFocusCapture}
              onBlurCapture={handleBlurCapture}
            >
              <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border/45 bg-background/80 px-2.5 py-2 dark:border-white/[0.07] dark:bg-zinc-950/82 sm:px-3">
                <div className="min-w-0 px-2">
                  <p className="truncate text-xs font-bold text-foreground/78 md:text-sm">
                    {activeSlide?.caption ?? activeSlide?.alt}
                  </p>
                  <p
                    aria-live={isManuallyPaused || interactionPaused ? "polite" : "off"}
                    aria-atomic="true"
                    className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Imagem {safeActiveIndex + 1} de {slideCount}
                  </p>
                </div>

                {slideCount > 1 ? (
                  <div className="flex shrink-0 items-center gap-1" aria-label="Controles do carrossel">
                    <button
                      type="button"
                      onClick={showPrevious}
                      aria-label="Mostrar imagem anterior"
                      className="public-tactile inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/55 bg-background/70 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:bg-white/[0.08]"
                    >
                      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    </button>
                    {supportsAutoplay ? (
                      <button
                        type="button"
                        onClick={() => setIsManuallyPaused((current) => !current)}
                        aria-label={
                          isManuallyPaused
                            ? "Retomar rotação automática"
                            : "Pausar rotação automática"
                        }
                        aria-pressed={isManuallyPaused}
                        className="public-tactile inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/55 bg-background/70 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:bg-white/[0.08]"
                      >
                        {isManuallyPaused ? (
                          <Play aria-hidden="true" className="h-3.5 w-3.5" />
                        ) : (
                          <Pause aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={showNext}
                      aria-label="Mostrar próxima imagem"
                      className="public-tactile inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/55 bg-background/70 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:bg-white/[0.08]"
                    >
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div
                className="relative aspect-video overflow-hidden bg-zinc-100 dark:bg-black"
              >
                <div
                  className={cn(
                    "flex h-full w-full",
                    shouldAnimateTrack &&
                      !prefersReducedMotion &&
                      "transition-transform duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
                  )}
                  style={{
                    transform: `translate3d(-${safeActiveIndex * 100}%, 0, 0)`,
                  }}
                >
                  {slides.map((image, index) => {
                    const previousIndex =
                      (safeActiveIndex - 1 + slideCount) % slideCount;
                    const nextIndex = (safeActiveIndex + 1) % slideCount;
                    const shouldLoad =
                      index === safeActiveIndex ||
                      index === previousIndex ||
                      index === nextIndex;

                    return (
                      <figure
                        key={`${image.src}-${index}`}
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${index + 1} de ${slideCount}`}
                        aria-hidden={index !== safeActiveIndex}
                        className="flex h-full w-full shrink-0 items-center justify-center"
                      >
                        {shouldLoad ? (
                          <img
                            src={image.src}
                            alt={image.alt}
                            width={1600}
                            height={900}
                            loading={
                              priority && index === safeActiveIndex
                                ? "eager"
                                : "lazy"
                            }
                            decoding={
                              priority && index === safeActiveIndex
                                ? "sync"
                                : "async"
                            }
                            fetchPriority={
                              priority && index === safeActiveIndex
                                ? "high"
                                : "auto"
                            }
                            draggable={false}
                            className="block h-full w-full select-none object-contain"
                          />
                        ) : null}
                      </figure>
                    );
                  })}
                </div>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`Abrir em tela cheia: ${activeSlide?.caption ?? activeSlide?.alt}`}
                  onClick={handleImageClick}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={clearPointer}
                  className="group absolute inset-0 z-10 cursor-zoom-in [touch-action:pan-y] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:cursor-grabbing"
                >
                  <span className="pointer-events-none absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                    <Maximize2 aria-hidden="true" className="h-4 w-4" />
                    Ampliar
                  </span>
                </button>
              </div>

              {slideCount > 1 ? (
                <div
                  ref={indicatorTrackRef}
                  role="group"
                  aria-label="Escolher imagem"
                  className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto border-t border-border/45 bg-background/80 px-2 py-1.5 dark:border-white/[0.07] dark:bg-zinc-950/82"
                >
                  {slides.map((image, index) => {
                    const isActive = index === safeActiveIndex;
                    return (
                      <button
                        key={`${image.src}-indicator-${index}`}
                        ref={(element) => {
                          indicatorRefs.current[index] = element;
                        }}
                        type="button"
                        onClick={() => showSlide(index)}
                        aria-label={`Mostrar imagem ${index + 1}: ${image.caption ?? image.alt}`}
                        aria-current={isActive ? "true" : undefined}
                        className="public-tactile group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                            isActive
                              ? "w-5 bg-foreground"
                              : "w-1.5 bg-foreground/22 group-hover:bg-foreground/45",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
        </ShowcaseFrame>

        <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
          <DialogContent
            showCloseButton={false}
            overlayClassName="z-[120] bg-black/92 backdrop-blur-xl"
            contentContainerClassName="z-[121] p-0"
            onKeyDown={handleLightboxKeyDown}
            className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-[#050506] p-0 text-white shadow-none sm:rounded-none"
          >
            <header className="flex min-h-16 shrink-0 items-center justify-between gap-5 border-b border-white/10 px-5 py-3 md:px-7">
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-black text-white md:text-base">
                  {title}
                </DialogTitle>
                <DialogDescription className="mt-1 truncate text-xs font-medium text-white/55">
                  {activeSlide?.caption ?? activeSlide?.alt} · Imagem {safeActiveIndex + 1} de {slideCount}
                </DialogDescription>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Fechar visualização em tela cheia"
                  className="public-tactile inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] text-white hover:bg-white/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </DialogClose>
            </header>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-16 py-4 md:px-24 md:py-6">
              {slideCount > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPrevious}
                    aria-label="Mostrar imagem anterior em tela cheia"
                    className="public-tactile absolute left-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:left-6 md:h-14 md:w-14"
                  >
                    <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={showNext}
                    aria-label="Mostrar próxima imagem em tela cheia"
                    className="public-tactile absolute right-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:right-6 md:h-14 md:w-14"
                  >
                    <ChevronRight aria-hidden="true" className="h-5 w-5" />
                  </button>
                </>
              ) : null}

              {activeSlide ? (
                <img
                  key={activeSlide.src}
                  src={activeSlide.src}
                  alt={activeSlide.alt}
                  width={1920}
                  height={1080}
                  decoding="sync"
                  draggable={false}
                  className="block max-h-full max-w-full select-none object-contain"
                />
              ) : null}
            </div>

            <footer className="flex min-h-16 shrink-0 items-center justify-center border-t border-white/10 px-5 py-2">
              {slideCount > 1 ? (
                <div
                  role="group"
                  aria-label="Escolher imagem na visualização em tela cheia"
                  className="no-scrollbar flex max-w-full items-center justify-center gap-0.5 overflow-x-auto"
                >
                  {slides.map((image, index) => {
                    const isActive = index === safeActiveIndex;
                    return (
                      <button
                        key={`${image.src}-lightbox-indicator-${index}`}
                        type="button"
                        onClick={() => showSlide(index)}
                        aria-label={`Mostrar imagem ${index + 1}: ${image.caption ?? image.alt}`}
                        aria-current={isActive ? "true" : undefined}
                        className="public-tactile group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                            isActive
                              ? "w-5 bg-white"
                              : "w-1.5 bg-white/25 group-hover:bg-white/55",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs font-bold text-white/50">Imagem 1 de 1</p>
              )}
            </footer>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}

export function PublicProductShowcase(props: PublicProductShowcaseProps) {
  if (props.variant === "youtube") {
    return <YoutubeShowcase {...props} />;
  }

  return <ScreenshotShowcase {...props} />;
}
