/**
 * Fórmulas de giz flutuando ao lado de cada elemento — o que o quadro SVG fazia
 * com `float()` (vaivém orgânico), agora como sprites sempre de frente para a
 * câmera. O vaivém usa o mesmo ruído (`scene/noise`), então o movimento tem a
 * mesma "respiração" do fundo da página.
 */

import type * as THREE from 'three';
import { drift } from '../noise';
import { createChalkSprite } from './chalkText';
import type { BuildContext } from './types';

export interface FloatingFormulaOptions {
  /** texto com a marcação de giz (`_{}`, `^{}`, `\\bar{}`) */
  text: string;
  color: string;
  /** altura da placa em unidades de cena */
  height?: number;
  position: [number, number, number];
  /** amplitude do vaivém */
  amplitude?: number;
  seed?: number;
}

export interface FloatingFormula {
  sprite: THREE.Sprite;
  update(t: number): void;
}

export function createFloatingFormula(
  ctx: BuildContext,
  options: FloatingFormulaOptions,
): FloatingFormula {
  const { sprite, plate } = createChalkSprite(
    [{ text: options.text, size: 46, color: options.color }],
    { worldHeight: options.height ?? 0.52 },
  );
  ctx.plates.push(plate);

  const [x, y, z] = options.position;
  const amplitude = options.amplitude ?? 0.09;
  const seed = options.seed ?? Math.random() * 100;
  sprite.position.set(x, y, z);

  return {
    sprite,
    update(t: number) {
      sprite.position.set(
        x + amplitude * drift(t * 0.32 + seed, seed),
        y + amplitude * drift(t * 0.26 + seed + 5, seed + 3),
        z,
      );
      // giz que respira: leve inclinação e opacidade variável, nunca piscando
      sprite.material.rotation = 0.025 * drift(t * 0.4 + seed, seed + 21);
      sprite.material.opacity = 0.8 + 0.2 * Math.abs(drift(t * 0.5 + seed + 9, seed + 11));
    },
  };
}
