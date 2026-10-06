/**
 * Projeção em perspectiva para a cena de fundo: converte profundidade (z)
 * em escala e desfoque, como uma câmera de verdade faria.
 * Convenção: z positivo = mais perto da câmera; z negativo = mais longe.
 *
 * Portado de `educa-data/src/lib/scene/projection.ts`.
 */
export const FOCAL = 900;

/** Fator de escala de um objeto a `z` px da câmera (1 = plano focal). */
export function projectScale(z: number, focal: number = FOCAL): number {
  const distance = Math.max(focal - z, 1);
  return focal / distance;
}

/**
 * Desfoque óptico aproximado: cresce conforme o objeto se afasta do plano
 * focal. `strength` é px de blur por px de distância.
 */
export function projectBlur(
  z: number,
  focusZ: number = 0,
  strength: number = 0.01,
  max: number = 7
): number {
  return Math.min(Math.abs(z - focusZ) * strength, max);
}

/** Interpolação linear usada pelas animações com inércia. */
export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** Passa o progresso por uma curva easeOutCubic (desacelera no fim). */
export function easeOutCubic(progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}
