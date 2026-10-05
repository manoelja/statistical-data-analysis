import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
    <div className={`result${highlight ? ' result--hl' : ''}`}>
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

export function Reveal({ steps, answer }: RevealProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button className="reveal__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {open ? 'Ocultar resolução' : 'Ver resolução passo a passo'}
      </button>

      {open && (
        <div className="reveal__content">
          <ol>
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <div className="reveal__answer">{answer}</div>
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
