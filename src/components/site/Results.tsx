import { motion } from 'framer-motion';
import { apgar, dataset, peso } from '../../data/results';
import { fmt } from '../../lib/stats';

interface IntervalVizProps {
  domain: [number, number];
  range: [number, number];
  param: number;
  digits: number;
}

function IntervalViz({ domain, range, param, digits }: IntervalVizProps) {
  const [lo, hi] = domain;
  const toPct = (v: number) => ((v - lo) / (hi - lo)) * 100;

  return (
    <div className="interval-viz">
      <div className="interval-viz__track">
        <div
          className="interval-viz__range"
          style={{ left: `${toPct(range[0])}%`, width: `${toPct(range[1]) - toPct(range[0])}%` }}
        />
        <div className="interval-viz__param" style={{ left: `${toPct(param)}%` }} title={`μ/p = ${fmt(param, digits)}`} />
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
    <section className="section" id="resultados">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Resultados</span>
          <h2>O intervalo cobriu o parâmetro?</h2>
          <p>
            A pergunta (d) de cada questão compara a estimativa amostral com o verdadeiro valor da
            população. É o teste prático do significado de “95% de confiança”.
          </p>
        </div>

        <div className="compare">
          <motion.div className="panel" style={{ padding: '1.5rem' }} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: '0.3rem' }}>
              Média do APGAR1
            </h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
              Base completa: {dataset.populacaoLinhas.toLocaleString('pt-BR')} registros, dos quais{' '}
              {dataset.apgarPopulacaoValidos.toLocaleString('pt-BR')} com APGAR1 válido.
            </p>

            <table className="data-table" style={{ marginTop: '1rem' }}>
              <tbody>
                <tr>
                  <td>Estimativa pontual (x̄)</td>
                  <td className="mono">{fmt(apgar.xbar)}</td>
                </tr>
                <tr>
                  <td>Média populacional (μ)</td>
                  <td className="mono">{fmt(apgar.muPopulacao)}</td>
                </tr>
                <tr>
                  <td>Erro amostral</td>
                  <td className="mono">{fmt(apgar.erroAmostral)}</td>
                </tr>
                <tr>
                  <td>IC 95%</td>
                  <td className="mono">[{fmt(apgar.icLower)}; {fmt(apgar.icUpper)}]</td>
                </tr>
              </tbody>
            </table>

            <IntervalViz domain={[8.0, 8.55]} range={[apgar.icLower, apgar.icUpper]} param={apgar.muPopulacao} digits={4} />
            <p style={{ marginTop: '0.8rem', color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
              μ = 8,3075 <strong>pertence</strong> ao IC — como esperado em 95% das amostras.
            </p>
          </motion.div>

          <motion.div className="panel" style={{ padding: '1.5rem' }} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.06 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: '0.3rem' }}>
              Proporção com peso ≥ 2.500 g
            </h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
              Base completa: {dataset.pesoPopulacaoValidos.toLocaleString('pt-BR')} registros com informação
              de peso. Baixo peso na população: {fmt(peso.baixoPesoPopulacao * 100, 2)}%.
            </p>

            <table className="data-table" style={{ marginTop: '1rem' }}>
              <tbody>
                <tr>
                  <td>Estimativa pontual (p̂)</td>
                  <td className="mono">{fmt(peso.phat)}</td>
                </tr>
                <tr>
                  <td>Proporção populacional (p)</td>
                  <td className="mono">{fmt(peso.populacao)}</td>
                </tr>
                <tr>
                  <td>Erro amostral</td>
                  <td className="mono">{fmt(peso.erroAmostral)}</td>
                </tr>
                <tr>
                  <td>IC 95%</td>
                  <td className="mono">[{fmt(peso.icLower)}; {fmt(peso.icUpper)}]</td>
                </tr>
              </tbody>
            </table>

            <IntervalViz domain={[0.88, 0.98]} range={[peso.icLower, peso.icUpper]} param={peso.populacao} digits={4} />
            <p style={{ marginTop: '0.8rem', color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
              p = 0,9052 também <strong>pertence</strong> ao IC amostral.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
