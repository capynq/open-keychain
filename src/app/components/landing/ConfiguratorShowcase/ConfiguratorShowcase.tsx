import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { Locale } from '@/infrastructure/i18n';
import { t } from '@/infrastructure/i18n';
import styles from './ConfiguratorShowcase.module.css';

type Slide = {
  id: string;
  kind: 'configurator' | 'photo';
  src?: string;
  alt: string;
  label: string;
  caption: string;
};

const getSlides = (locale: Locale): Slide[] => [
  {
    id: 'configurator',
    kind: 'configurator',
    alt: t(locale, 'landing.previewAlt'),
    label: t(locale, 'landing.previewTag'),
    caption: t(locale, 'landing.previewCaption'),
  },
  {
    id: 'print-example-1',
    kind: 'photo',
    src: locale === 'en' ? '/showcase/prints/example_1-en.png' : '/showcase/prints/example_1.png',
    alt: t(locale, 'landing.printExample1Alt'),
    label: t(locale, 'landing.printExampleLabel'),
    caption: t(locale, 'landing.printExample1Caption'),
  },
  {
    id: 'print-example-2',
    kind: 'photo',
    src: locale === 'en' ? '/showcase/prints/example_2-en.png' : '/showcase/prints/example_2.png',
    alt: t(locale, 'landing.printExample2Alt'),
    label: t(locale, 'landing.printExampleLabel'),
    caption: t(locale, 'landing.printExample2Caption'),
  },
];

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ConfiguratorShowcase = ({ locale }: { locale: Locale }) => {
  const slides = getSlides(locale);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const emblaOptions = useMemo(
    () => ({
      loop: true,
      duration: 20,
      dragFree: false,
      skipSnaps: false,
      watchDrag: !reducedMotion,
    }),
    [reducedMotion],
  );
  const [viewportRef, emblaApi] = useEmblaCarousel(emblaOptions);
  const [active, setActive] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const movingRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreferenceChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);

    mediaQuery.addEventListener('change', onPreferenceChange);
    return () => mediaQuery.removeEventListener('change', onPreferenceChange);
  }, []);

  const onSelect = useCallback(() => {
    if (emblaApi) setActive(emblaApi.selectedScrollSnap());
  }, [emblaApi]);
  const onScroll = useCallback(() => {
    if (reducedMotion) return;
    if (!movingRef.current) {
      movingRef.current = true;
      setIsMoving(true);
    }
  }, [reducedMotion]);
  const onSettle = useCallback(() => {
    movingRef.current = false;
    setIsMoving(false);
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('scroll', onScroll);
    emblaApi.on('settle', onSettle);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
      emblaApi.off('scroll', onScroll);
      emblaApi.off('settle', onSettle);
    };
  }, [emblaApi, onSelect, onScroll, onSettle]);

  const navigate = useCallback(
    (action: (instant: boolean) => void) => {
      if (!emblaApi || movingRef.current) return;
      const instant = reducedMotion;
      if (!instant) {
        movingRef.current = true;
        setIsMoving(true);
      }
      action(instant);
    },
    [emblaApi, reducedMotion],
  );
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigate((instant) => emblaApi?.scrollNext(instant));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigate((instant) => emblaApi?.scrollPrev(instant));
    }
  };

  return (
    <figure
      className={`${styles.root} configurator-showcase`}
      role="region"
      aria-roledescription="carousel"
      aria-label={t(locale, 'landing.previewLabel')}
    >
      <div
        className="configurator-carousel"
        ref={viewportRef}
        tabIndex={0}
        data-moving={isMoving ? 'true' : 'false'}
        onKeyDown={onKeyDown}
      >
        <div className="configurator-carousel-track">
          {slides.map((slide, index) => (
            <div
              className="configurator-window configurator-carousel-slide"
              data-showcase-slide={slide.id}
              data-showcase-kind={slide.kind}
              data-active={index === active ? 'true' : 'false'}
              aria-hidden={index === active ? undefined : true}
              key={slide.id}
            >
              <div className="configurator-window-bar">
                <span className="configurator-window-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="configurator-window-label">
                  {slide.kind === 'configurator' ? (
                    <>
                      <span className="configurator-desktop-label">
                        {t(locale, 'landing.desktopWorkspace')}
                      </span>
                      <span className="configurator-mobile-label">
                        {t(locale, 'landing.mobileWorkspace')}
                      </span>
                    </>
                  ) : (
                    <span className="configurator-print-label">
                      {t(locale, 'landing.printExampleLabel')}
                    </span>
                  )}
                </span>
                {slide.kind === 'configurator' && (
                  <span className="configurator-window-status">
                    {t(locale, 'landing.localBadge')}
                  </span>
                )}
              </div>
              <div
                className={`configurator-carousel-media configurator-carousel-media-${slide.kind}`}
              >
                {slide.kind === 'configurator' ? (
                  <picture>
                    <source
                      media="(max-width: 760px)"
                      srcSet="/showcase/create-mobile.png 1x, /showcase/create-mobile@2x.png 2x"
                      sizes="100vw"
                    />
                    <img
                      src="/showcase/create-desktop.png"
                      srcSet="/showcase/create-desktop.png 1x"
                      sizes="(max-width: 760px) 100vw, 50vw"
                      alt={slide.alt}
                      width="1440"
                      height="900"
                      fetchPriority="high"
                      loading="eager"
                    />
                  </picture>
                ) : (
                  <img src={slide.src} alt={slide.alt} width="1254" height="1254" loading="lazy" />
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          className="configurator-carousel-arrow configurator-carousel-prev"
          type="button"
          data-showcase-control="previous"
          aria-label={t(locale, 'landing.carouselPrevious')}
          disabled={!emblaApi || isMoving}
          onClick={() => navigate((instant) => emblaApi?.scrollPrev(instant))}
        >
          ‹
        </button>
        <button
          className="configurator-carousel-arrow configurator-carousel-next"
          type="button"
          data-showcase-control="next"
          aria-label={t(locale, 'landing.carouselNext')}
          disabled={!emblaApi || isMoving}
          onClick={() => navigate((instant) => emblaApi?.scrollNext(instant))}
        >
          ›
        </button>
      </div>
      <div className="configurator-carousel-status" aria-live="polite">
        {t(locale, 'landing.carouselSlideStatus', { current: active + 1, total: slides.length })}
      </div>
      <div
        className="configurator-carousel-dots"
        role="group"
        aria-label={t(locale, 'landing.carouselSelect')}
      >
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            data-showcase-control={`slide-${index + 1}`}
            data-active={active === index ? 'true' : 'false'}
            aria-label={t(locale, 'landing.carouselSelectSlide', { number: index + 1 })}
            aria-pressed={active === index}
            disabled={!emblaApi || isMoving}
            onClick={() => navigate((instant) => emblaApi?.scrollTo(index, instant))}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
      <figcaption className="configurator-showcase-caption">
        <span>{slides[active].label}</span>
        <span aria-hidden="true">·</span>
        <span>{slides[active].caption}</span>
      </figcaption>
    </figure>
  );
};
