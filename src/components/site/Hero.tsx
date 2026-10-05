import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { dataset } from '../../data/results';

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export function Hero() {
  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="hero" id="hero">
      <div className="container hero__grid">
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.12 }}
        >
          <motion.span className="eyebrow" variants={reveal}>
            Probabilidade &amp; Inferência · 2026
          </motion.span>

          <motion.h1 className="hero__title" variants={reveal}>
            Probabilidade &amp; <em>Inferência</em> Estatística
          </motion.h1>

          <motion.p className="hero__lede" variants={reveal}>
            Cinco questões que percorrem Binomial, Poisson e Normal até intervalos de confiança e testes
            de hipóteses — com dados reais de nascidos vivos do SINASC/DataSUS (2024).
          </motion.p>

          <motion.div className="hero__cta" variants={reveal}>
            <button className="btn btn--primary" onClick={() => goTo('probabilidade')}>
              Explorar a Parte 1 <ArrowRight size={16} />
            </button>
            <button className="btn btn--ghost" onClick={() => goTo('inferencia')}>
              Ir para a Parte 2
            </button>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero__stats"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          <div className="stat">
            <div className="stat__label">Amostra</div>
            <div className="stat__value">
              {dataset.amostraTotal}
              <small>nascidos</small>
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">APGAR válidos</div>
            <div className="stat__value">
              {dataset.apgarValidos}
              <small>de 200</small>
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Base completa</div>
            <div className="stat__value">{(dataset.populacaoLinhas / 1e6).toFixed(2).replace('.', ',')}
              <small>mi</small>
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Confiança</div>
            <div className="stat__value">95<small>%</small></div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
