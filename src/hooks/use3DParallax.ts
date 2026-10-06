/**
 * use3DParallax — hook reutilizável para paralaxe 3D.
 *
 * Suporta três fontes de entrada:
 *  - Mouse (desktop): ponteiro relativo ao centro da janela
 *  - Touch (mobile): arraste com um dedo
 *  - DeviceOrientation (mobile com giroscópio): inclinação do dispositivo
 *
 * Retorna `{ x, y }` suavizados via spring para usar em transforms CSS/Framer-motion.
 */

import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, type MotionValue } from 'framer-motion';

interface Parallax3DOptions {
  /** Intensidade da rotação em graus. Default: 12 */
  strength?: number;
  /** Rigidez do spring. Default: 80 */
  stiffness?: number;
  /** Amortecimento do spring. Default: 20 */
  damping?: number;
}

interface Parallax3DResult {
  /** Rotação em X (-strength … +strength graus) */
  rotateX: MotionValue<number>;
  /** Rotação em Y (-strength … +strength graus) */
  rotateY: MotionValue<number>;
  /** Translação Z relativa (-20px … +20px), para destacar o elemento */
  translateZ: MotionValue<number>;
}

export function use3DParallax(options: Parallax3DOptions = {}): Parallax3DResult {
  const { strength = 12, stiffness = 80, damping = 20 } = options;

  // Valores-alvo (brutos, sem spring)
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  // Springs suavizados
  const rotateX = useSpring(rawX, { stiffness, damping, mass: 0.6 });
  const rotateY = useSpring(rawY, { stiffness, damping, mass: 0.6 });
  const translateZ = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });

  // Detecta se o usuário prefere movimento reduzido
  const reducedRef = useRef(
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (reducedRef.current) return;

    // ---------- Mouse ----------
    function onMouse(e: MouseEvent) {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;   // -1 … 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      rawY.set(nx * strength);
      rawX.set(-ny * strength);
      translateZ.set(10);
    }

    function onMouseLeave() {
      rawX.set(0);
      rawY.set(0);
      translateZ.set(0);
    }

    // ---------- Touch ----------
    let touchStartX = 0;
    let touchStartY = 0;

    function onTouchStart(e: TouchEvent) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      rawY.set((dx / window.innerWidth) * strength * 1.5);
      rawX.set((-dy / window.innerHeight) * strength * 1.5);
    }

    function onTouchEnd() {
      rawX.set(0);
      rawY.set(0);
      translateZ.set(0);
    }

    // ---------- DeviceOrientation (giroscópio) ----------
    function onOrientation(e: DeviceOrientationEvent) {
      const beta  = e.beta  ?? 0;   // -180 … 180 (inclinação para frente/trás)
      const gamma = e.gamma ?? 0;   // -90 … 90  (inclinação lateral)
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      const ny = clamp(gamma / 45, -1, 1);
      const nx = clamp((beta - 45) / 45, -1, 1); // 45° é posição de leitura natural
      rawY.set(ny * strength * 0.6);
      rawX.set(-nx * strength * 0.6);
    }

    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('deviceorientation', onOrientation, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('deviceorientation', onOrientation);
    };
  }, [rawX, rawY, translateZ, strength]);

  return { rotateX, rotateY, translateZ };
}
