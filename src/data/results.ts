/**
 * Resultados oficiais da atividade (conferidos no R 4.6.0 — ver `statistical-data-analysis.Rmd`).
 * Usados como valores iniciais dos sliders e nas comparações amostra × população.
 */

export const dataset = {
  amostraTotal: 200,
  apgarValidos: 198,
  apgarExcluidos: 2,
  populacaoLinhas: 2_389_325,
  apgarPopulacaoValidos: 2_363_658,
  pesoPopulacaoValidos: 2_389_104,
} as const;

export const apgar = {
  xbar: 8.2778,
  s: 1.4527,
  se: 0.1032,
  tCrit: 1.9721,
  icLower: 8.0742,
  icUpper: 8.4814,
  assimetria: -2.474,
  muPopulacao: 8.3075,
  mu0: 7,
  testeT: 12.3771,
  gl: 197,
  pValor: 2.096858e-26,
  erroAmostral: -0.0297,
} as const;

export const peso = {
  n: 200,
  sucessos: 186,
  phat: 0.93,
  se: 0.01804,
  zCrit: 1.96,
  icLower: 0.8946,
  icUpper: 0.9654,
  p0: 0.9,
  testeZ: 1.4142,
  pValor: 0.1573,
  populacao: 0.9052,
  baixoPesoPopulacao: 0.0948,
  erroAmostral: 0.0248,
} as const;
