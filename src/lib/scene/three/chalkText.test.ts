import { describe, expect, it } from 'vitest';
import { PX_PER_UNIT, createChalkPlate, createFixedPlate } from './chalkText';

/**
 * As placas de giz são desenhadas num canvas 2D e viram textura. Em jsdom não há
 * contexto 2D, então o que dá para conferir aqui é a **medida** — e ela é
 * exatamente o que decide se uma fórmula cabe inteira na face do cubo ou é
 * cortada nas duas pontas (`drawRich` centraliza a partir do meio, então um
 * texto largo demais vaza dos dois lados).
 */

const px = (units: number) => units * PX_PER_UNIT;

describe('chalkText — medida das placas', () => {
  it('placa livre: a largura segue o texto, a altura segue a fonte', () => {
    const short = createChalkPlate([{ text: 'z', size: 52, color: '#ffffff' }], { pad: 14 });
    const long = createChalkPlate([{ text: 'z = (x − μ)/σ', size: 52, color: '#ffffff' }], {
      pad: 14,
    });

    expect(long.width).toBeGreaterThan(short.width);
    // a altura é a da linha (fonte + padding): um texto mais longo não a muda
    expect(long.height).toBe(short.height);
  });

  it('face quadrada: o canvas CRESCE para a fórmula caber inteira', () => {
    // a conta mais longa do cubo. Numa face de 512 ela era cortada nas duas
    // pontas — era o defeito mais visível da página.
    const face = createFixedPlate(
      [{ text: 'R² = 1 − Σ(y_{i} − ŷ_{i})²/Σ(y_{i} − \\bar{y})²', size: 62, color: '#ffffff' }],
      512,
      54,
    );

    expect(px(face.width)).toBeGreaterThan(512);
    // e continua quadrada, senão a face do cubo estica o texto
    expect(face.width).toBe(face.height);
  });

  it('face quadrada: fórmula curta continua em 512 (nada de desperdício)', () => {
    const face = createFixedPlate([{ text: 'z = (x − μ)/σ', size: 62, color: '#ffffff' }], 512, 54);
    expect(px(face.width)).toBe(512);
  });

  it('face quadrada: texto absurdo tem teto, mas nunca passa do limite', () => {
    const face = createFixedPlate([{ text: 'x'.repeat(4000), size: 62, color: '#ffffff' }], 512, 54);
    expect(px(face.width)).toBeLessThanOrEqual(1536);
    expect(face.width).toBe(face.height);
  });
});
