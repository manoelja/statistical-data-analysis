import { motion } from 'framer-motion';
import { Database, Sigma, Microscope, Ruler } from 'lucide-react';
import { dataset } from '../../data/results';

export function Overview() {
  return (
    <section className="section" id="visao">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Visão geral</span>
          <h2>Da variabilidade aleatória à decisão</h2>
          <p>
            A atividade se divide em duas partes. A primeira pergunta “qual a chance?”; a segunda
            pergunta “quão confiante posso estar?”. Ambas usam a mesma fonte: nascidos vivos de 2024
            (SINASC/DataSUS).
          </p>
        </div>

        <div className="overview__grid">
          <motion.div className="card" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
            <h3><Database size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />O conjunto de dados</h3>
            <p>
              Duas bases reduzidas do SINASC 2024: uma amostra aleatória simples de {dataset.amostraTotal}{' '}
              registros e a base completa com todas as observações.
            </p>
            <table className="data-table" style={{ marginTop: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Variável</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">APGAR1</td>
                  <td>Apgar no 1º minuto (0 a 10)</td>
                </tr>
                <tr>
                  <td className="mono">PESO</td>
                  <td>Peso ao nascer, em gramas</td>
                </tr>
              </tbody>
            </table>
          </motion.div>

          <motion.div className="card card--gold" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.05 }}>
            <h3><Sigma size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Parte 1 — Probabilidade</h3>
            <ul>
              <li><strong>Binomial</strong>: nº de defeitos em lotes de equipamentos.</li>
              <li><strong>Poisson</strong>: admissões por hora em uma maternidade.</li>
              <li><strong>Normal</strong>: peso ao nascer e padronização em escores z.</li>
            </ul>
          </motion.div>

          <motion.div className="card card--teal" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.1 }}>
            <h3><Microscope size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Parte 2 — Inferência</h3>
            <ul>
              <li><strong>Média (APGAR1)</strong>: estimativa, IC 95% com t e teste t.</li>
              <li><strong>Proporção (peso ≥ 2.500 g)</strong>: estimativa, IC de Wald e teste z.</li>
              <li>Comparação da amostra com o verdadeiro parâmetro populacional.</li>
            </ul>
          </motion.div>

          <motion.div className="card" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.15 }}>
            <h3><Ruler size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />Metodologia</h3>
            <ul>
              <li>Nível de confiança de 95% e significância de 5% na Parte 2.</li>
              <li>
                Em APGAR1, o código <span className="formula-inline">99</span> (“ignorado”) e os faltantes
                foram tratados como dados faltantes → n = {dataset.apgarValidos}.
              </li>
              <li>Todos os números desta página foram conferidos no R 4.6.0.</li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
