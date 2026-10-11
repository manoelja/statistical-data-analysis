/**
 * Results — seção de resultados com animações 3D:
 * - Entrada dos painéis com rotateX (efeito de livro se abrindo)
 * - Cards numéricos com depth e hover 3D
 * - Barra de intervalo com animação de preenchimento
 */

import { motion } from 'framer-motion';
import { apgar, dataset, peso } from '../../data/results';
import { fmt } from '../../lib/stats';
import { CardDeck } from './CardDeck';

interface IntervalVizProps {
  domain: [number, number];
  range: [number, number];
  param: number;
  digits: number;
}

function IntervalViz({ domain, range, param, digits }: IntervalVizProps) {
  const [lo, hi] = domain;
  const toPct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const leftPct  = toPct(range[0]);
  const widthPct = toPct(range[1]) - leftPct;
  const paramPct = toPct(param);

  return (
    <div className="interval-viz">
      <div className="interval-viz__track">
        <motion.div
          className="interval-viz__range"
          initial={{ left: `${paramPct}%`, width: '0%' }}
          whileInView={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.div
          className="interval-viz__param"
          style={{ left: `${paramPct}%` }}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.8 }}
          title={`μ/p = ${fmt(param, digits)}`}
        />
      </div>
      <div className="interval-viz__labels">
        <span>{fmt(lo, digits)}</span>
        <span>parâmetro = {fmt(param, digits)}</span>
        <span>{fmt(hi, digits)}</span>
      </div>
    </div>
  );
}

export function Results() {
  return (
    <section className="section results--3d">
      <div className="container">
        {/* Cabeçalho com entrada perspectiva */}
        <motion.div
          className="section-head"
          initial={{ opacity: 0, rotateX: -14, y: 20 }}
          whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{ perspective: '600px' }}
        >
          <span className="eyebrow">Resultados</span>
          <h2>O intervalo cobriu o parâmetro?</h2>
          <p>
            A pergunta (d) de cada questão compara a estimativa amostral com o
            verdadeiro valor da população. É o teste prático do significado de
            "95% de confiança".
          </p>
        </motion.div>

        {/* A pilha de resultados — um painel por vez */}
        <CardDeck label="Resultados do intervalo de confiança">
          {/* Painel APGAR */}
          <motion.div
            className="panel panel--3d card-base card-base--lg"
            style={{ transformStyle: 'preserve-3d' }}
            whileHover={{ rotateY: 3, rotateX: -2, translateZ: 10, transition: { duration: 0.3 } }}
          >
            <h3 className="panel__title">
              Média do APGAR1
            </h3>
            <p className="panel__body">
              Base completa: {dataset.populacaoLinhas.toLocaleString('pt-BR')} registros, dos quais{' '}
              {dataset.apgarPopulacaoValidos.toLocaleString('pt-BR')} com APGAR1 válido.
            </p>

            <table className="data-table panel__table">
              <tbody>
                {[
                  ['Estimativa pontual (x̄)', fmt(apgar.xbar)],
                  ['Média populacional (μ)',  fmt(apgar.muPopulacao)],
                  ['Erro amostral',           fmt(apgar.erroAmostral)],
                  ['IC 95%',                  `[${fmt(apgar.icLower)}; ${fmt(apgar.icUpper)}]`],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="mono">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <IntervalViz
              domain={[8.0, 8.55]}
              range={[apgar.icLower, apgar.icUpper]}
              param={apgar.muPopulacao}
              digits={4}
            />
            <p className="panel__note">
              μ = 8,3075 <strong>pertence</strong> ao IC — como esperado em 95% das amostras.
            </p>
          </motion.div>

          {/* Painel Proporção */}
          <motion.div
            className="panel panel--3d card-base card-base--lg"
            style={{ transformStyle: 'preserve-3d' }}
            whileHover={{ rotateY: -3, rotateX: -2, translateZ: 10, transition: { duration: 0.3 } }}
          >
            <h3 className="panel__title">
              Proporção com peso ≥ 2.500 g
            </h3>
            <p className="panel__body">
              Base completa: {dataset.pesoPopulacaoValidos.toLocaleString('pt-BR')} registros com
              informação de peso. Baixo peso na população: {fmt(peso.baixoPesoPopulacao * 100, 2)}%.
            </p>

            <table className="data-table panel__table">
              <tbody>
                {[
                  ['Estimativa pontual (p̂)',    fmt(peso.phat)],
                  ['Proporção populacional (p)', fmt(peso.populacao)],
                  ['Erro amostral',               fmt(peso.erroAmostral)],
                  ['IC 95%',                      `[${fmt(peso.icLower)}; ${fmt(peso.icUpper)}]`],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="mono">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <IntervalViz
              domain={[0.88, 0.98]}
              range={[peso.icLower, peso.icUpper]}
              param={peso.populacao}
              digits={4}
            />
            <p className="panel__note">
              p = 0,9052 também <strong>pertence</strong> ao IC amostral.
            </p>
          </motion.div>
        </CardDeck>
      </div>
    </section>
  );
}
