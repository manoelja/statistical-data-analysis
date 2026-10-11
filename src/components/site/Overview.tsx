/**
 * Overview — a visão geral da atividade, um cartão por vez.
 *
 * ## Por que não é mais um card que gira
 *
 * Era um card 3D que virava 180° no hover, revelando uma face traseira. Tirou:
 * passar o mouse numa grade de quatro cards **gira os quatro de uma vez** (o
 * hover entra e sai conforme o ponteiro atravessa), então nenhuma das faces
 * ficava legível, e o `aria-pressed` estava num `div` sem papel — quem navega
 * por teclado nunca girava nada.
 *
 * ## A pilha
 *
 * Cada cartão é uma peça só, com o conteúdo das duas faces empilhado (a frente
 * e, abaixo de um fio, o que era o verso). Quem segura a ordem é o `CardDeck`:
 * aparece um cartão por vez, o próximo já espreita por baixo e clicar na carta
 * de cima traz o seguinte — sem chip "Próximo" no canto, que era o botão que
 * este componente carregava antes.
 */

import { motion } from 'framer-motion';
import { Database, Sigma, Microscope, Ruler } from 'lucide-react';
import { dataset } from '../../data/results';
import { CardDeck } from './CardDeck';

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
      accent: '#818cf8',
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
      accent: '#fbbf24',
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
      accent: '#5eead4',
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
      accent: '#fda4af',
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

/* ---- o cartão da visão geral ---- */
function OverviewCard({ card }: { card: CardData }) {
  return (
    <article
      className="ov-card card-base"
      style={{ ['--ov-accent' as string]: card.accent }}
    >
      <div className="ov-card__icon">{card.icon}</div>
      <h3>{card.title}</h3>

      <div className="ov-card__face">{card.front}</div>

      {/* o que era a face traseira: entra no corpo, separado por um fio */}
      <div className="ov-card__face ov-card__face--extra">{card.back}</div>
    </article>
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

        {/* A pilha de cartões da visão geral — um por vez, clicar avança */}
        <CardDeck label="Visão geral da atividade">
          {cards.map((card) => (
            <OverviewCard key={card.title} card={card} />
          ))}
        </CardDeck>
      </div>
    </section>
  );
}
