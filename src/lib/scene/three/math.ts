/**
 * Matemática pura da cena 3D — **sem Three.js e sem DOM**.
 *
 * Tudo que a cena precisa *calcular* (Normal, regressão, interseção do Venn,
 * soma de dados) vive aqui, e não dentro dos módulos que montam `Mesh`: assim a
 * conta é testável em Node (`math.test.ts`) e a geometria só cuida de geometria.
 *
 * Portado/estendido a partir das contas do quadro `data-science-quadro.html`.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * Persegue um alvo com suavização exponencial — o resultado não depende do FPS
 * (ao contrário de `lerp` com fator fixo por quadro).
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/** Ângulo equivalente a `target` mais próximo de `current` (soma voltas de 2π). */
export function nearestAngle(current: number, target: number): number {
  const turn = Math.PI * 2;
  return target + Math.round((current - target) / turn) * turn;
}

/** Densidade da Normal em `x`, para média `mu` e desvio `sigma`. */
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.SQRT2 * Math.sqrt(Math.PI));
}

/** Padronização z = (x − μ)/σ. */
export function zScore(x: number, mu: number, sigma: number): number {
  return sigma > 0 ? (x - mu) / sigma : 0;
}

export interface Regression {
  /** intercepto β₀ */
  b0: number;
  /** inclinação β₁ */
  b1: number;
  /** coeficiente de determinação R² */
  r2: number;
  /** número de pontos usados */
  n: number;
}

/**
 * Mínimos quadrados ordinários. Devolve a reta e o R² — os mesmos números do
 * quadro (`ŷ = b0 + b1x   R² = ...`), agora sobre os pontos da nuvem 3D.
 */
export function linearRegression(points: readonly { x: number; y: number }[]): Regression {
  const n = points.length;
  if (n < 2) return { b0: n === 1 ? points[0].y : 0, b1: 0, r2: 0, n };

  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }

  if (sxx === 0) return { b0: my, b1: 0, r2: 0, n };
  const b1 = sxy / sxx;
  const b0 = my - b1 * mx;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { b0, b1, r2, n };
}

/** Resíduo de um ponto em relação à reta ajustada. */
export function residualOf(point: { x: number; y: number }, line: Regression): number {
  return point.y - (line.b0 + line.b1 * point.x);
}

/**
 * Área da lente (interseção) de dois círculos iguais de raio `radius` cujos
 * centros distam `distance`. É o que dá base honesta ao P(A∩B) do Venn 3D.
 */
export function lensArea(distance: number, radius: number): number {
  if (radius <= 0) return 0;
  const d = clamp(distance, 0, 2 * radius);
  const half = Math.sqrt(Math.max(0, 4 * radius * radius - d * d));
  return 2 * radius * radius * Math.acos(clamp(d / (2 * radius), -1, 1)) - (d / 2) * half;
}

/** Fração de cada círculo que cai na sobreposição — em [0, 1]. */
export function overlapRatio(distance: number, radius: number): number {
  const circle = Math.PI * radius * radius;
  return circle > 0 ? clamp(lensArea(distance, radius) / circle, 0, 1) : 0;
}

/**
 * Contagem de formas de obter cada soma ao rolar `count` dados de `sides` faces.
 * Índice = soma (0 e 1 ficam zerados). Convolução discreta, sem tabela fixa.
 */
export function diceSumCounts(count = 2, sides = 6): number[] {
  let counts: number[] = [1];
  for (let die = 0; die < count; die += 1) {
    const next = new Array<number>(counts.length + sides).fill(0);
    for (let sum = 0; sum < counts.length; sum += 1) {
      if (counts[sum] === 0) continue;
      for (let face = 1; face <= sides; face += 1) next[sum + face] += counts[sum];
    }
    counts = next;
  }
  return counts;
}

/** Probabilidade de cada soma ao rolar `count` dados (índice = soma). */
export function diceSumPmf(count = 2, sides = 6): number[] {
  const counts = diceSumCounts(count, sides);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.map((c) => c / total);
}

/** P(soma = `sum`) ao rolar `count` dados de `sides` faces. */
export function diceSumProbability(sum: number, count = 2, sides = 6): number {
  const pmf = diceSumPmf(count, sides);
  return pmf[sum] ?? 0;
}

/** Mistura dois hex (#rrggbb) — usada para tingir os resíduos e os temas. */
export function mixHex(from: string, to: string, amount: number): string {
  const t = clamp(amount, 0, 1);
  const a = parseHex(from);
  const b = parseHex(to);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

/**
 * Cor do resíduo: verde (colado na reta) → amarelo → vermelho (longe).
 * `maxAbs` é o resíduo que satura a escala (normalmente o maior da nuvem).
 */
export function residualColor(residual: number, maxAbs: number, green: string, yellow: string, red: string): string {
  const t = maxAbs > 0 ? clamp(Math.abs(residual) / maxAbs, 0, 1) : 0;
  return t < 0.5 ? mixHex(green, yellow, t * 2) : mixHex(yellow, red, (t - 0.5) * 2);
}
