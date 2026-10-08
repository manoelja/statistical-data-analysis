/**
 * Paleta de giz e tons da ardósia — **fonte única** das cores do quadro animado.
 *
 * Portado do motor de cena do projeto `educa-data` (`lib/scene/chalk.ts`) e
 * adaptado às cores do quadro de Data Science. O quadro vive no escuro (giz
 * aceso sobre ardósia), então a cena tem uma paleta só: não há variante para
 * trocar.
 */

export interface ChalkPalette {
  /** Giz principal (linhas e texto). */
  chalk: string;
  cyan: string;
  yellow: string;
  pink: string;
  orange: string;
  green: string;
  blue: string;
  red: string;
  /** Tons do gradiente da superfície da ardósia. */
  board0: string;
  board1: string;
  /** Cor da lâmpada. */
  bulb: string;
}

/** Giz neon sobre ardósia — fiel ao quadro original. */
export const CHALK: ChalkPalette = {
  chalk: '#f2f1ea',
  cyan: '#27c4e0',
  yellow: '#f7c531',
  pink: '#ee3f7a',
  orange: '#f08a2b',
  green: '#5fd35a',
  blue: '#2f8fe0',
  red: '#ff4d4d',
  board0: '#2a2f31',
  board1: '#121516',
  bulb: '#ffd23f',
};
