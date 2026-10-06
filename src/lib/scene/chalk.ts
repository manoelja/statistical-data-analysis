/**
 * Paleta de giz e tons da ardósia — **fonte única** das cores do quadro animado.
 *
 * Portado do motor de cena do projeto `educa-data` (`lib/scene/chalk.ts`) e
 * adaptado às cores do quadro de Data Science. Enquanto o `educa-data` espelha
 * estes tons em tokens CSS (`--chalk-*`), aqui o fundo é um SVG imperativo e
 * consome a paleta direto por tema — por isso as duas variantes ficam juntas,
 * num lugar só.
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

/** Tema escuro: fiel ao quadro original (giz neon sobre ardósia). */
export const CHALK_DARK: ChalkPalette = {
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

/** Tema claro: "tinta sobre papel", na paleta do site (accent/gold/teal/rose). */
export const CHALK_LIGHT: ChalkPalette = {
  chalk: '#4a453b',
  cyan: '#0e7490',
  yellow: '#b45309',
  pink: '#be123c',
  orange: '#c2410c',
  green: '#15803d',
  blue: '#4338ca',
  red: '#dc2626',
  board0: '#fdfbf6',
  board1: '#f1ece1',
  bulb: '#d97706',
};
