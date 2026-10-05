import { useEffect, useState } from 'react';

/** Retorna o id da seção mais visível na viewport. */
export function useActiveSection(sectionIds: string[]): string {
  const [active, setActive] = useState(sectionIds[0] ?? '');

  useEffect(() => {
    const ratios = new Map<string, number>();
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => ratios.set(id, entry.intersectionRatio));

          let best = sectionIds[0] ?? '';
          let bestRatio = -1;
          ratios.forEach((ratio, key) => {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              best = key;
            }
          });
          if (bestRatio > 0) setActive(best);
        },
        { threshold: [0, 0.15, 0.35, 0.6, 0.85], rootMargin: '-72px 0px -45% 0px' },
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [sectionIds]);

  return active;
}
