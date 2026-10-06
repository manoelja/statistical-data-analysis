/**
 * Overview — seção de visão geral com cards 3D flip interativos.
 *
 * Cada card tem uma face frontal e uma face traseira. No hover/toque,
 * o card gira 180° em Y revelando conteúdo adicional. As entradas da seção
 * usam perspectiva 3D (rotateX de baixo para cima, como páginas de livro).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Sigma, Microscope, Ruler, BarChart2, FlaskConical } from 'lucide-react';
import { dataset } from '../../data/results';

/* ---- Dados dos cards ---- */
interface CardData {
  icon: React.ReactNode;
  title: string;
  accent: string;
  front: React.ReactNode;
  back: React.ReactNode;
}

function getCards(apgarValidos: number, amostraTotal: number): CardData[] {
  return [
    {
      icon: <Database size={20} />,
      title: 'O conjunto de dados',
      accent: '#4338ca',
      front: (
        <>
          <p>
            Duas bases do SINASC 2024: amostra aleatória de{' '}
            <strong>{amostraTotal}</strong> registros e a base completa.
          </p>
          <ul className="ov-card__list">
            <li><span className="mono">APGAR1</span> — Apgar no 1º minuto (0-10)</li>
            <li><span className="mono">PESO</span> — Peso ao nascer, em gramas</li>
          </ul>
        </>
      ),
      back: (
        <>
          <p className="ov-card__back-label">Estatísticas da base</p>
          <div className="ov-card__back-stats">
            <div><span className="ov-card__big">{amostraTotal}</span><small>amostras</small></div>
            <div><span className="ov-card__big">{apgarValidos}</span><small>APGAR válidos</small></div>
          </div>
          <p>Todos os resultados foram conferidos no <strong>R 4.6.0</strong>.</p>
        </>
      ),
    },
    {
      icon: <Sigma size={20} />,
      title: 'Parte 1 — Probabilidade',
      accent: '#b45309',
      front: (
        <ul className="ov-card__list">
          <li><strong>Binomial</strong>: nº de defeitos em lotes de equipamentos.</li>
          <li><strong>Poisson</strong>: admissões por hora em uma maternidade.</li>
          <li><strong>Normal</strong>: peso ao nascer e padronização em escores z.</li>
        </ul>
      ),
      back: (
        <>
          <p className="ov-card__back-label">Distribuições cobertas</p>
          <div className="ov-card__back-dists">
            {['Binomial B(n,p)', 'Poisson Poi(λ)', 'Normal N(μ,σ²)'].map(d => (
              <div key={d} className="ov-card__dist-pill">{d}</div>
            ))}
          </div>
        </>
      ),
    },
    {
      icon: <Microscope size={20} />,
      title: 'Parte 2 — Inferência',
      accent: '#0f766e',
      front: (
        <ul className="ov-card__list">
          <li><strong>Média (APGAR1)</strong>: estimativa, IC 95% com t e teste t.</li>
          <li><strong>Proporção (peso ≥ 2.500 g)</strong>: IC de Wald e teste z.</li>
          <li>Comparação da amostra com o verdadeiro parâmetro populacional.</li>
        </ul>
      ),
      back: (
        <>
          <p className="ov-card__back-label">Métodos estatísticos</p>
          <div className="ov-card__back-dists">
            {['IC com t de Student', 'Teste bilateral z', 'IC de Wald'].map(m => (
              <div key={m} className="ov-card__dist-pill">{m}</div>
            ))}
          </div>
        </>
      ),
    },
    {
      icon: <Ruler size={20} />,
      title: 'Metodologia',
      accent: '#be123c',
      front: (
        <ul className="ov-card__list">
          <li>Nível de confiança 95% e significância de 5% na Parte 2.</li>
          <li>
            Em APGAR1, o código <span className="formula-inline">99</span> e faltantes
            foram removidos → n = {apgarValidos}.
          </li>
          <li>Todos os números conferidos no R 4.6.0.</li>
        </ul>
      ),
      back: (
        <>
          <p className="ov-card__back-label">Parâmetros globais</p>
          <div className="ov-card__back-params">
            <div><span className="ov-card__big">95%</span><small>confiança</small></div>
            <div><span className="ov-card__big">5%</span><small>significância</small></div>
            <div><span className="ov-card__big">R 4.6</span><small>software</small></div>
          </div>
        </>
      ),
    },
  ];
}

/* ---- Card Flip 3D ---- */
function FlipCard({ card, index }: { card: CardData; index: number }) {
  const [flipped, setFlipped] = useState(false);

  const toggle = () => setFlipped(f => !f);

  return (
    <motion.div
      className="flip-card"
      initial={{ opacity: 0, rotateX: -25, y: 30 }}
      whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: '900px' }}
      onHoverStart={toggle}
      onHoverEnd={toggle}
      onTap={toggle}
      aria-pressed={flipped}
    >
      <motion.div
        className="flip-card__inner"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformStyle: 'preserve-3d', position: 'relative', height: '100%' }}
      >
        {/* Face frontal */}
        <div
          className="flip-card__face flip-card__face--front"
          style={{ borderLeftColor: card.accent }}
        >
          <div className="flip-card__icon" style={{ color: card.accent }}>{card.icon}</div>
          <h3>{card.title}</h3>
          {card.front}
          <div className="flip-card__hint">Hover / toque para girar</div>
        </div>

        {/* Face traseira */}
        <div
          className="flip-card__face flip-card__face--back"
          style={{ borderLeftColor: card.accent }}
        >
          <div className="flip-card__icon" style={{ color: card.accent }}>
            {index % 2 === 0 ? <BarChart2 size={20} /> : <FlaskConical size={20} />}
          </div>
          <h3>{card.title}</h3>
          {card.back}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Overview() {
  const cards = getCards(dataset.apgarValidos, dataset.amostraTotal);

  return (
    <section className="section overview--3d">
      <div className="container">
        {/* Cabeçalho com entrada 3D */}
        <motion.div
          className="section-head"
          initial={{ opacity: 0, rotateX: -18, y: 24 }}
          whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ perspective: '600px' }}
        >
          <span className="eyebrow">Visão geral</span>
          <h2>Da variabilidade aleatória à decisão</h2>
          <p>
            A atividade se divide em duas partes. A primeira pergunta "qual a
            chance?"; a segunda pergunta "quão confiante posso estar?". Ambas
            usam a mesma fonte: nascidos vivos de 2024 (SINASC/DataSUS).
          </p>
        </motion.div>

        {/* Grid de cards com flip 3D */}
        <div className="overview__grid overview__grid--flip">
          {cards.map((card, i) => (
            <FlipCard key={card.title} card={card} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
