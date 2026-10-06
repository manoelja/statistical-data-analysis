import { useEffect, useRef } from 'react';

interface RafLoopOptions {
  /** Limite de quadros por segundo (economiza bateria no mobile) */
  fps?: number;
  enabled?: boolean;
}

/**
 * Loop único de animação: respeita um teto de FPS e congela quando a aba está
 * em segundo plano. Uma cena com vários efeitos deve usar um loop só — vários
 * `requestAnimationFrame` concorrentes é o caminho mais rápido para travar.
 *
 * Portado de `educa-data/src/hooks/useRafLoop.ts`.
 */
export function useRafLoop(
  callback: (deltaMs: number, elapsedMs: number) => void,
  { fps = 60, enabled = true }: RafLoopOptions = {}
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const interval = 1000 / fps;
    let frame = 0;
    let last = 0;
    let elapsed = 0;

    const loop = (timestamp: number) => {
      frame = requestAnimationFrame(loop);

      if (document.visibilityState !== 'visible') {
        last = timestamp;
        return;
      }

      if (last !== 0 && timestamp - last < interval) return;

      const delta = last === 0 ? interval : timestamp - last;
      last = timestamp;
      elapsed += delta;

      callbackRef.current(delta, elapsed);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [fps, enabled]);
}
