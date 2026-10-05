/**
 * Funções estatísticas em TypeScript puro, sem dependências.
 *
 * Os valores são conferidos contra o R/SciPy nos testes em `stats.test.ts`,
 * garantindo que os sliders da página mostrem os mesmos números do relatório.
 */

const LANCZOS_G = [
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** log da função gama (aproximação de Lanczos). */
export function logGamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = 0.99999999999980993;
  const t = z + 7.5;
  for (let i = 0; i < LANCZOS_G.length; i++) {
    a += LANCZOS_G[i] / (z + i + 1);
  }
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

export function logFactorial(n: number): number {
  return logGamma(n + 1);
}

/** Função erro (aproximação de Numerical Recipes, erro ~1e-7). */
export function erf(x: number): number {
  const t = 1 / (1 + 0.5 * Math.abs(x));
  const tau =
    t *
    Math.exp(
      -x * x -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? 1 - tau : tau - 1;
}

/** Função de distribuição acumulada Normal. */
export function pnorm(x: number, mean = 0, sd = 1): number {
  return 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
}

/** Quantil da Normal padrão (algoritmo de Acklam). */
export function qnorm(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new RangeError('qnorm: p deve estar em (0, 1)');
  }
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/** Fração contínua para a função beta incompleta (Numerical Recipes). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Função beta incompleta regularizada I_x(a, b). */
export function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** FDA da distribuição t de Student. */
export function pt(t: number, df: number): number {
  const x = df / (df + t * t);
  const ib = 0.5 * betai(df / 2, 0.5, x);
  return t > 0 ? 1 - ib : ib;
}

/** p-valor bilateral do teste t. */
export function tTestTwoSidedP(t: number, df: number): number {
  return betai(df / 2, 0.5, df / (df + t * t));
}

/** Quantil da distribuição t de Student (busca binária). */
export function qt(p: number, df: number): number {
  let lo = -1e4;
  let hi = 1e4;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (pt(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Função de probabilidade da Binomial. */
export function dbinom(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  const logp =
    logFactorial(n) -
    logFactorial(k) -
    logFactorial(n - k) +
    k * Math.log(p) +
    (n - k) * Math.log(1 - p);
  return Math.exp(logp);
}

/** FDA da Binomial (soma até k). */
export function pbinom(k: number, n: number, p: number): number {
  const limit = Math.floor(k);
  let acc = 0;
  for (let i = 0; i <= limit; i++) acc += dbinom(i, n, p);
  return Math.min(1, acc);
}

/** Função de probabilidade da Poisson. */
export function dpois(k: number, lambda: number): number {
  if (k < 0) return 0;
  return Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k));
}

/** FDA da Poisson (soma até k). */
export function ppois(k: number, lambda: number): number {
  const limit = Math.floor(k);
  let acc = 0;
  for (let i = 0; i <= limit; i++) acc += dpois(i, lambda);
  return Math.min(1, acc);
}

/** Intervalo de confiança para a média (t de Student). */
export function meanConfidenceInterval(
  xbar: number,
  s: number,
  n: number,
  alpha: number,
): { lower: number; upper: number; se: number; tCrit: number } {
  const se = s / Math.sqrt(n);
  const tCrit = qt(1 - alpha / 2, n - 1);
  return { lower: xbar - tCrit * se, upper: xbar + tCrit * se, se, tCrit };
}

/** Teste t para uma média. */
export function oneSampleT(
  xbar: number,
  s: number,
  n: number,
  mu0: number,
): { t: number; df: number; p: number } {
  const df = n - 1;
  const t = (xbar - mu0) / (s / Math.sqrt(n));
  return { t, df, p: tTestTwoSidedP(t, df) };
}

/** Intervalo de confiança de Wald para uma proporção. */
export function proportionConfidenceInterval(
  x: number,
  n: number,
  alpha: number,
): { phat: number; se: number; lower: number; upper: number; zCrit: number } {
  const phat = x / n;
  const se = Math.sqrt((phat * (1 - phat)) / n);
  const zCrit = qnorm(1 - alpha / 2);
  return { phat, se, lower: phat - zCrit * se, upper: phat + zCrit * se, zCrit };
}

/** Teste z para uma proporção. */
export function oneProportionZ(
  x: number,
  n: number,
  p0: number,
): { phat: number; z: number; p: number } {
  const phat = x / n;
  const z = (phat - p0) / Math.sqrt((p0 * (1 - p0)) / n);
  const p = 2 * (1 - pnorm(Math.abs(z)));
  return { phat, z, p };
}

/** Formata número no padrão brasileiro. */
export function fmt(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Notação científica legível. */
export function sci(value: number, digits = 3): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exp;
  return `${mantissa.toFixed(digits).replace('.', ',')} × 10^${exp}`;
}
