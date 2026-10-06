/**
 * Ruído de valor (value noise) determinístico e barato — usado para dar
 * movimento orgânico às partículas em vez de senoides previsíveis.
 *
 * Portado de `educa-data/src/lib/scene/noise.ts`.
 */

function hash(value: number): number {
  const x = Math.sin(value * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Ruído 1D suavizado em [0, 1]. */
export function noise1(x: number, seed: number = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i + seed * 57.31);
  const b = hash(i + 1 + seed * 57.31);
  const smooth = f * f * (3 - 2 * f);
  return a + (b - a) * smooth;
}

/** Ruído centrado em 0, na faixa [-1, 1]. */
export function drift(x: number, seed: number = 0): number {
  return noise1(x, seed) * 2 - 1;
}
