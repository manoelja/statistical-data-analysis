import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';

const FORMULAS = [
  {
    tag: 'Binomial',
    expr: 'P(X = k) = C(n,k) · pᵏ · (1 − p)ⁿ⁻ᵏ',
    note: 'n provas fixas, dois resultados e probabilidade constante.',
  },
  {
    tag: 'Poisson',
    expr: 'P(X = k) = e⁻λ · λᵏ / k!',
    note: 'Contagem de eventos raros em um intervalo, com média λ.',
  },
  {
    tag: 'Normal',
    expr: 'z = (x − μ) / σ',
    note: 'Padronizar transforma qualquer Normal na Normal padrão.',
  },
  {
    tag: 'IC da média',
    expr: 'x̄ ± t₍₁₋α/₂, n₋₁₎ · s / √n',
    note: 'σ desconhecido ⇒ t de Student com n − 1 graus de liberdade.',
  },
  {
    tag: 'Teste t',
    expr: 't = (x̄ − μ₀) / (s / √n)',
    note: 'Compara a média observada com a hipótese μ₀.',
  },
  {
    tag: 'IC da proporção',
    expr: 'p̂ ± z₍₁₋α/₂₎ · √(p̂(1 − p̂) / n)',
    note: 'Aproximação normal de Wald.',
  },
  {
    tag: 'Teste z',
    expr: 'z = (p̂ − p₀) / √(p₀(1 − p₀) / n)',
    note: 'Usa o erro padrão sob a hipótese nula p₀.',
  },
  {
    tag: 'Requisitos',
    expr: 'AAS · independência · n ≥ 30 · np̂ ≥ 10',
    note: 'Amostra aleatória simples e TCL garantem a validade das aproximações.',
  },
];

/** Copia o texto para a área de transferência com feedback visual. */
function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback para contextos sem Clipboard API (ex.: http não seguro)
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (!ok) throw new Error('execCommand falhou');
      }
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    window.setTimeout(() => setStatus('idle'), 1800);
  };

  const label =
    status === 'copied' ? 'Copiado!' : status === 'error' ? 'Erro ao copiar' : 'Copiar fórmula';

  return (
    <button
      type="button"
      className={`formula__copy${status === 'copied' ? ' is-copied' : ''}`}
      onClick={copy}
      aria-label={label}
      title={label}
    >
      {status === 'copied' ? <Check size={13} /> : <Copy size={13} />}
      <span>{status === 'copied' ? 'Copiado!' : 'Copiar'}</span>
    </button>
  );
}

export function FormulaSheet() {
  return (
    <section className="section" id="formulario">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Formulário</span>
          <h2>A “cola” que resolve tudo</h2>
          <p>
            Se você reconhece o modelo e sabe qual fórmula aplicar, o restante é aritmética — e os
            laboratórios acima confirmam cada número.
          </p>
        </div>

        <div className="formulas">
          {FORMULAS.map((f, i) => (
            <motion.div
              key={f.tag}
              className="formula"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: (i % 4) * 0.05 }}
            >
              <div className="formula__head">
                <h4>{f.tag}</h4>
                <CopyButton text={f.expr} />
              </div>
              <div className="formula__expr">{f.expr}</div>
              <p>{f.note}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
