// =============================================================================
// Card carousel
// =============================================================================
// Generic horizontal snap-scroll row of cards + pagination dots underneath
// that track which card is currently in view (one IntersectionObserver
// watching every card, rooted to the scroll track) and let a dot click
// smooth-scroll to that card. Domain-agnostic -- callers (each calculator's
// own estimateStructureNav.tsx) map their own wall/kit data into `items` and
// render each card via `renderItem`, the same generic-list/render-prop split
// ui/itemPillScroller.tsx already uses for the phone pill strip. No existing
// scroll-spy component to reuse here -- estimateResultsCard.tsx's header
// comment references an old "SectionNav" IntersectionObserver pattern, but
// that component was removed when project mode moved to tabs.
// =============================================================================
import { useEffect, useRef, useState } from "react";

export const CardCarousel = <T,>({ items, itemKey, renderItem, cardClassName = "" }: {
  items: T[];
  itemKey: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => React.ReactNode;
  cardClassName?: string;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      entries => {
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) best = entry;
        }
        if (best) {
          const idx = cardRefs.current.findIndex(el => el === best!.target);
          if (idx !== -1) setActive(idx);
        }
      },
      { root: track, threshold: [0.5, 0.75, 1] }
    );
    cardRefs.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const scrollToIndex = (i: number) => {
    cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  return (
    <div>
      <div ref={trackRef} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2" style={{ scrollbarWidth: "none" }}>
        {items.map((item, i) => (
          <div
            key={itemKey(item, i)}
            ref={el => { cardRefs.current[i] = el; }}
            className={`shrink-0 snap-start ${cardClassName}`}
          >
            {renderItem(item, i)}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {items.map((item, i) => (
            <button
              key={itemKey(item, i)}
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to item ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === active ? 18 : 6,
                background: "var(--blue)",
                opacity: i === active ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
