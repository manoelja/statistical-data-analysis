import { describe, expect, it } from 'vitest';
import { CHALK } from './chalk';
import { drift, noise1 } from './noise';
import { easeOutCubic, lerp, projectBlur, projectScale } from './projection';

describe('scene/chalk', () => {
  it('é uma paleta só, com todas as cores hex válidas', () => {
    const keys = Object.keys(CHALK);
    expect(keys).toEqual([
      'chalk',
      'cyan',
      'yellow',
      'pink',
      'orange',
      'green',
      'blue',
      'red',
      'board0',
      'board1',
      'bulb',
    ]);
    for (const value of Object.values(CHALK)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // a ardósia é escura: é o fundo da cena e do quadro
    expect(CHALK.board1).toBe('#121516');
  });
});

describe('scene/noise', () => {
  it('mantém noise1 em [0, 1] e drift em [-1, 1]', () => {
    for (let x = 0; x < 200; x += 0.37) {
      const n = noise1(x, 3);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);

      const d = drift(x, 3);
      expect(d).toBeGreaterThanOrEqual(-1);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it('é determinístico para a mesma entrada', () => {
    expect(noise1(12.34, 7)).toBe(noise1(12.34, 7));
    expect(drift(12.34, 7)).not.toBe(drift(12.34, 8));
  });
});

describe('scene/projection', () => {
  it('escala: mais perto (z>0) fica maior, mais longe (z<0) fica menor', () => {
    expect(projectScale(200)).toBeGreaterThan(1);
    expect(projectScale(-200)).toBeLessThan(1);
    expect(projectScale(0)).toBe(1);
  });

  it('desfoque cresce com a distância e respeita o teto', () => {
    expect(projectBlur(0)).toBe(0);
    expect(projectBlur(100)).toBeLessThan(projectBlur(200));
    expect(projectBlur(100000, 0, 0.012, 4)).toBe(4);
  });

  it('lerp interpola e easeOutCubic fecha em 0 e 1', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
