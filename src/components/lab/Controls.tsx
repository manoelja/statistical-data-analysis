import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display?: string;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step = 1, display, onChange }: SliderProps) {
  return (
    <label className="field">
      <span className="field__row">
        <span className="field__label">{label}</span>
        <span className="field__value">{display ?? value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}

export function NumberField({ label, value, step = 1, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="num-input"
        type="number"
        step={step}
        value={editing ? draft : value}
        onFocus={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        onBlur={() => setEditing(false)}
      />
    </label>
  );
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}

export function Stat({ label, value, hint, highlight }: StatProps) {
  return (
    <div className={`result card-base card-base--sm card-lift${highlight ? ' result--hl' : ''}`}>
      <div className="result__label">{label}</div>
      <div className="result__value">{value}</div>
      {hint && <div className="result__hint">{hint}</div>}
    </div>
  );
}

interface RevealProps {
  steps: ReactNode[];
  answer: ReactNode;
}

/**
 * "Ver resolução" — a resolução **cobre** o conteúdo em vez de crescer abaixo.
 *
 * ## Por que não abre embaixo
 *
 * Aberto no fluxo, o painel empurrava tudo o que vinha depois dele: os
 * resultados saíam da área visível, o cartão ganhava altura e a leitura da
 * resolução começava com a pergunta já fora da tela. Pior: num card de altura
 * travada (`journey__card-inner`) a resolução alongava o conteúdo e o que
 * aparecia era um corte mudo.
 *
 * ## O que ele é agora
 *
 * Uma camada por cima do **corpo** do cartão (`position: absolute` contra o
 * `.qcard__body`): o cabeçalho da questão continua visível acima — quem está
 * lendo a resolução quase sempre quer reler o enunciado —, o resto do corpo fica
 * coberto, e nada se desloca. A camada rola por dentro, porque os cinco passos
 * mais a resposta são mais altos que o corpo numa janela baixa.
 *
 * O gatilho some sob a camada, então o fechamento é explícito: o botão do X no
 * topo do painel. `aria-controls` liga os dois, e `aria-expanded` continua no
 * gatilho.
 */
export function Reveal({ steps, answer }: RevealProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="reveal">
      <button
        className="reveal__toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        {open ? 'Ocultar resolução' : 'Ver resolução passo a passo'}
      </button>

      {open && (
        <div id={panelId} className="reveal__panel" role="region" aria-label="Resolução passo a passo">
          <div className="reveal__panel-head">
            <span className="reveal__panel-title">Resolução passo a passo</span>
            <button
              type="button"
              className="reveal__close"
              onClick={() => setOpen(false)}
              aria-label="Fechar resolução"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          <div className="reveal__content">
            <ol>
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <div className="reveal__answer">{answer}</div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DistributionBarsProps {
  values: number[];
  markIndex?: number;
  hotIndexes?: number[];
  labels: [string, string];
}

export function DistributionBars({ values, markIndex, hotIndexes = [], labels }: DistributionBarsProps) {
  const max = Math.max(...values, 1e-12);

  return (
    <div>
      <div className="mini-chart" role="img" aria-label="Distribuição de probabilidade">
        {values.map((v, i) => {
          const isMark = i === markIndex;
          const isHot = hotIndexes.includes(i);
          return (
            <div
              key={i}
              className={`mini-chart__bar${isHot ? ' is-hot' : ''}${isMark ? ' is-mark' : ''}`}
              style={{ height: `${Math.max((v / max) * 100, 1.5)}%` }}
              title={`x = ${i} → ${v.toExponential(3)}`}
            />
          );
        })}
      </div>
      <div className="mini-chart__axis">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
      </div>
    </div>
  );
}
