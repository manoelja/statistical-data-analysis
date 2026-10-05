import { describe, expect, it } from 'vitest';
import {
  dbinom,
  dpois,
  meanConfidenceInterval,
  oneProportionZ,
  oneSampleT,
  pbinom,
  pnorm,
  ppois,
  proportionConfidenceInterval,
  qnorm,
  qt,
} from './stats';

/**
 * Valores de referência obtidos no R 4.6.0 com os dados reais da atividade
 * (ver `statistical-data-analysis.Rmd`). Servem de contrato: se algum número mudar, os testes quebram.
 */
describe('stats — Parte 1 (probabilidade)', () => {
  it('Binomial: P(X=3) com n=3, p=0.02', () => {
    expect(dbinom(3, 3, 0.02)).toBeCloseTo(0.000008, 10);
  });

  it('Binomial: P(X>=1) com n=20, p=0.02', () => {
    expect(1 - pbinom(0, 20, 0.02)).toBeCloseTo(0.3324, 4);
  });

  it('Poisson: P(X=4) com lambda=4', () => {
    expect(dpois(4, 4)).toBeCloseTo(0.1953668, 6);
  });

  it('Poisson: P(X=14) e P(X>=14) com lambda=4', () => {
    expect(dpois(14, 4)).toBeCloseTo(5.639669e-5, 9);
    expect(1 - ppois(13, 4)).toBeCloseTo(7.632842e-5, 9);
  });

  it('Poisson: 1 em cada ~13101 horas', () => {
    expect(Math.round(1 / (1 - ppois(13, 4)))).toBe(13101);
  });

  it('Normal: P(X<2500) com mu=3250, sd=500', () => {
    expect(pnorm(2500, 3250, 500)).toBeCloseTo(0.0668, 4);
  });

  it('Normal: P(3000<X<4000)', () => {
    expect(pnorm(4000, 3250, 500) - pnorm(3000, 3250, 500)).toBeCloseTo(0.6247, 4);
  });

  it('Normal: quantil z_{0.975} = 1.96', () => {
    expect(qnorm(0.975)).toBeCloseTo(1.959964, 5);
  });
});

describe('stats — Parte 2 (inferência)', () => {
  it('Média: IC 95% com xbar=8.2778, s=1.4527, n=198', () => {
    const ic = meanConfidenceInterval(8.2778, 1.4527, 198, 0.05);
    expect(ic.se).toBeCloseTo(0.1032, 3);
    expect(ic.tCrit).toBeCloseTo(1.9721, 3);
    expect(ic.lower).toBeCloseTo(8.0742, 3);
    expect(ic.upper).toBeCloseTo(8.4814, 3);
  });

  it('Média: teste t (xbar - 7)', () => {
    const res = oneSampleT(8.2778, 1.4527, 198, 7);
    expect(res.df).toBe(197);
    expect(res.t).toBeCloseTo(12.377, 2);
    expect(res.p).toBeLessThan(1e-20);
  });

  it('Média: quantil t_{0.975, 197} = 1.9721', () => {
    expect(qt(0.975, 197)).toBeCloseTo(1.9721, 4);
  });

  it('Proporção: IC 95% com 186 de 200', () => {
    const ic = proportionConfidenceInterval(186, 200, 0.05);
    expect(ic.phat).toBeCloseTo(0.93, 10);
    expect(ic.se).toBeCloseTo(0.01804, 4);
    expect(ic.lower).toBeCloseTo(0.8946, 4);
    expect(ic.upper).toBeCloseTo(0.9654, 4);
  });

  it('Proporção: teste z contra p0=0.90', () => {
    const res = oneProportionZ(186, 200, 0.9);
    expect(res.z).toBeCloseTo(1.4142, 4);
    expect(res.p).toBeCloseTo(0.1573, 4);
  });
});
