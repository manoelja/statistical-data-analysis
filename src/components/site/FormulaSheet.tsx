/**
 * FormulaSheet — formulário de fórmulas com cards 3D:
 * - Cada card entra com rotateY (como cartas sendo viradas)
 * - Hover com depth 3D e brilho lateral
 * - Botão de cópia com animação 3D
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';

const FORMULAS = [
  { tag: 'Binomial',       expr: 'P(X = k) = C(n,k) · pᵏ · (1 − p)ⁿ⁻ᵏ',   note: 'n provas fixas, dois resultados e probabilidade constante.' },
  { tag: 'Poisson',        expr: 'P(X = k) = e⁻λ · λᵏ / k!',                note: 'Contagem de eventos raros em um intervalo, com média λ.' },
  { tag: 'Normal',         expr: 'z = (x − μ) / σ',                          note: 'Padronizar transforma qualquer Normal na Normal padrão.' },
  { tag: 'IC da média',    expr: 'x̄ ± t₍₁₋α/₂, n₋₁₎ · s / √n',            note: 'σ desconhecido ⇒ t de Student com n − 1 graus de liberdade.' },
  { tag: 'Teste t',        expr: 't = (x̄ − μ₀) / (s / √n)',                 note: 'Compara a média observada com a hipótese μ₀.' },
  { tag: 'IC da proporção',expr: 'p̂ ± z₍₁₋α/₂₎ · √(p̂(1 − p̂) / n)',      note: 'Aproximação normal de Wald.' },
  { tag: 'Teste z',        expr: 'z = (p̂ − p₀) / √(p₀(1 − p₀) / n)',       note: 'Usa o erro padrão sob a hipótese nula p₀.' },
  { tag: 'Requisitos',     expr: 'AAS · independência · n ≥ 30 · np̂ ≥ 10', note: 'Amostra aleatória simples e TCL garantem a validade das aproximações.' },
];

function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    window.setTimeout(() => setStatus('idle'), 1800);
  };

  const label = status === 'copied' ? 'Copiado!' : status === 'error' ? 'Erro ao copiar' : 'Copiar fórmula';

  return (
    <motion.button
      type="button"
      className={`formula__copy${status === 'copied' ? ' is-copied' : ''}`}
      onClick={copy}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9, rotateZ: -8 }}
      whileHover={{ scale: 1.06 }}
    >
      {status === 'copied' ? <Check size={13} /> : <Copy size={13} />}
      <span>{status === 'copied' ? 'Copiado!' : 'Copiar'}</span>
    </motion.button>
  );
}

export function FormulaSheet() {
  return (
    <section className="section formulas--3d">
      <div className="container">
        <motion.div
          className="section-head"
          initial={{ opacity: 0, rotateX: -14, y: 20 }}
          whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{ perspective: '600px' }}
        >
          <span className="eyebrow">Formulário</span>
          <h2>A "cola" que resolve tudo</h2>
          <p>
            Se você reconhece o modelo e sabe qual fórmula aplicar, o restante é
            aritmética — e os laboratórios acima confirmam cada número.
          </p>
        </motion.div>

        <div className="formulas" style={{ perspective: '1000px' }}>
          {FORMULAS.map((f, i) => (
            <motion.div
              key={f.tag}
              className="formula formula--3d"
              initial={{ opacity: 0, rotateY: -18, x: -16 }}
              whileInView={{ opacity: 1, rotateY: 0, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: (i % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{
                rotateY: 4,
                rotateX: -3,
                translateZ: 14,
                scale: 1.02,
                transition: { duration: 0.3 },
              }}
              whileTap={{ scale: 0.98 }}
              style={{ transformStyle: 'preserve-3d', cursor: 'default' }}
            >
              <div className="formula__head">
                <h4>{f.tag}</h4>
                <CopyButton text={f.expr} />
              </div>
              <div className="formula__expr">{f.expr}</div>
              <p>{f.note}</p>
              {/* Brilho lateral 3D */}
              <div className="formula__shine" aria-hidden="true" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
