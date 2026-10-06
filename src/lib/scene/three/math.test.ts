import { describe, expect, it } from 'vitest';
import {
  clamp,
  damp,
  diceSumCounts,
  diceSumProbability,
  lensArea,
  lerp,
  linearRegression,
  mixHex,
  nearestAngle,
  normalPdf,
  overlapRatio,
  residualColor,
  residualOf,
  zScore,
} from './math';

describe('three/math — utilidades', () => {
  it('clamp, lerp e nearestAngle se comportam como esperado', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    // 2π − 1,2 rad é o *mesmo* ângulo que −1,2 rad: o mais próximo é ele mesmo
    const volta = nearestAngle(-1.2, Math.PI * 2 - 1.2);
    expect(volta).toBeCloseTo(-1.2, 10);
    expect((volta - (Math.PI * 2 - 1.2)) / (Math.PI * 2)).toBeCloseTo(-1, 10);
    expect(nearestAngle(0.1, 0.2)).toBeCloseTo(0.2);
  });

  it('damp converge para o alvo sem depender do FPS', () => {
    const passo = (dt: number, vezes: number) => {
      let v = 0;
      for (let i = 0; i < vezes; i += 1) v = damp(v, 10, 3, dt);
      return v;
    };
    // 60 quadros de 16,7 ms ≈ 1 s de animação em 6 quadros de 167 ms
    expect(passo(1 / 60, 60)).toBeCloseTo(passo(1 / 6, 6), 2);
    expect(passo(1 / 60, 60)).toBeGreaterThan(9);
    expect(passo(1 / 60, 60)).toBeLessThan(10.001);
  });
});

describe('three/math — Normal', () => {
  it('bate com os valores tabelados da densidade padrão', () => {
    expect(normalPdf(0)).toBeCloseTo(0.3989, 4);
    expect(normalPdf(1)).toBeCloseTo(0.242, 3);
    expect(normalPdf(-1)).toBeCloseTo(normalPdf(1), 10);
  });

  it('integra ≈ 1 e desloca/achata com μ e σ', () => {
    let soma = 0;
    const passo = 0.01;
    for (let x = -8; x <= 8; x += passo) soma += normalPdf(x, 2, 1.5) * passo;
    expect(soma).toBeCloseTo(1, 2);

    // o pico cai em x = μ e escala com 1/σ
    expect(normalPdf(2, 2, 1.5)).toBeGreaterThan(normalPdf(2.5, 2, 1.5));
    expect(normalPdf(0, 0, 0.5)).toBeCloseTo(2 * normalPdf(0, 0, 1), 6);
    expect(normalPdf(0, 0, 0.4)).toBeGreaterThan(2 * normalPdf(0, 0, 1));
  });

  it('padroniza com z = (x − μ)/σ', () => {
    expect(zScore(2500, 3250, 500)).toBeCloseTo(-1.5, 10);
  });
});

describe('three/math — regressão', () => {
  it('recupera β₀, β₁ e R² de uma reta perfeita', () => {
    const pontos = [-2, -1, 0, 1, 2].map((x) => ({ x, y: 1 + 2 * x }));
    const linha = linearRegression(pontos);
    expect(linha.b0).toBeCloseTo(1, 10);
    expect(linha.b1).toBeCloseTo(2, 10);
    expect(linha.r2).toBeCloseTo(1, 10);
    expect(linha.n).toBe(5);
  });

  it('perde R² com ruído e devolve o resíduo ponto a ponto', () => {
    const pontos = [1, 2, 3, 4].map((x) => ({ x, y: 2 + x + (x % 2 ? 0.6 : -0.6) }));
    const linha = linearRegression(pontos);
    expect(linha.r2).toBeLessThan(1);
    expect(linha.r2).toBeGreaterThan(0.6);
    // a reta ajustada é ŷ = 2,6 + 0,76x → resíduo em x=1 fica 0,24
    expect(linha.b0).toBeCloseTo(2.6, 10);
    expect(linha.b1).toBeCloseTo(0.76, 10);
    expect(residualOf({ x: 1, y: 3.6 }, linha)).toBeCloseTo(0.24, 10);
  });

  it('aguenta casos degenerados (0, 1 ponto e x constante)', () => {
    expect(linearRegression([])).toEqual({ b0: 0, b1: 0, r2: 0, n: 0 });
    expect(linearRegression([{ x: 3, y: 7 }])).toEqual({ b0: 7, b1: 0, r2: 0, n: 1 });
    const vertical = linearRegression([
      { x: 1, y: 1 },
      { x: 1, y: 5 },
    ]);
    expect(vertical.b1).toBe(0);
    expect(vertical.r2).toBe(0);
  });
});

describe('three/math — Venn', () => {
  it('área da lente vai do círculo inteiro (d=0) a zero (d=2r)', () => {
    const r = 2;
    expect(lensArea(0, r)).toBeCloseTo(Math.PI * r * r, 6);
    expect(lensArea(2 * r, r)).toBeCloseTo(0, 6);
    // resultado clássico para centros a uma distância igual ao raio
    expect(lensArea(r, r)).toBeCloseTo(2 * r * r * (Math.PI / 3 - Math.sqrt(3) / 4), 6);
  });

  it('encolhe conforme os centros se afastam, e a fração fica em [0,1]', () => {
    const r = 1.9;
    const amostra = [0, 0.5, 1, 1.5, 2, 3, 3.8].map((d) => lensArea(d, r));
    for (let i = 1; i < amostra.length; i += 1) expect(amostra[i]).toBeLessThan(amostra[i - 1]);
    expect(overlapRatio(0, r)).toBeCloseTo(1, 6);
    for (const d of [0, 0.7, 1.9, 3.8, 9]) {
      const fracao = overlapRatio(d, r);
      expect(fracao).toBeGreaterThanOrEqual(0);
      expect(fracao).toBeLessThanOrEqual(1);
    }
  });
});

describe('three/math — dados', () => {
  it('conta as 36 combinações de 2d6 e soma 1 na pmf', () => {
    const contagens = diceSumCounts(2, 6);
    expect(contagens).toEqual([0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]);
    expect(diceSumProbability(7)).toBeCloseTo(6 / 36, 10);
    expect(diceSumProbability(2)).toBeCloseTo(1 / 36, 10);

    const total = diceSumCounts(2, 6).reduce((a, b) => a + b, 0);
    expect(total).toBe(36);
    expect(diceSumCounts(3, 6).reduce((a, b) => a + b, 0)).toBe(216);
  });
});

describe('three/math — cores', () => {
  it('mistura hex e satura a cor do resíduo', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#27c4e0', '#27c4e0', 0.9)).toBe('#27c4e0');
    expect(mixHex('#fff', '#000', 1)).toBe('#000000');
  });

  it('pinta perto de verde e longe de vermelho', () => {
    expect(residualColor(0, 4, '#00ff00', '#ffff00', '#ff0000')).toBe('#00ff00');
    expect(residualColor(4, 4, '#00ff00', '#ffff00', '#ff0000')).toBe('#ff0000');
    expect(residualColor(-4, 4, '#00ff00', '#ffff00', '#ff0000')).toBe('#ff0000');
    expect(residualColor(2, 4, '#00ff00', '#ffff00', '#ff0000')).toBe('#ffff00');
    // escala degenerada não deve explodir
    expect(residualColor(3, 0, '#00ff00', '#ffff00', '#ff0000')).toBe('#00ff00');
  });
});
