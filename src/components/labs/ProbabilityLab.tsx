import { useEffect, useMemo, useState } from 'react';
import { LabSection } from '../lab/LabSection';
import { QuestionCard } from '../lab/QuestionCard';
import { DistributionBars, Reveal, Slider, Stat } from '../lab/Controls';
import { dbinom, dpois, fmt, pnorm, sci } from '../../lib/stats';
import { setSceneParams } from '../../lib/scene/store';
import { useSceneParams } from '../../hooks/useSceneParams';

const ITEMS = [
  { id: 'q1', short: 'Binomial' },
  { id: 'q2', short: 'Poisson' },
  { id: 'q3', short: 'Normal' },
];

function BinomialLab() {
  const [n, setN] = useState(20);
  const [p, setP] = useState(0.02);
  const [k, setK] = useState(1);

  // Unificação conteúdo ↔ animação: os sliders alimentam o quadro animado.
  useEffect(() => {
    setSceneParams({ n, p });
  }, [n, p]);

  const bars = useMemo(() => Array.from({ length: n + 1 }, (_, i) => dbinom(i, n, p)), [n, p]);
  const atK = dbinom(k, n, p);
  const upToK = bars.slice(0, k + 1).reduce((a, b) => a + b, 0);
  const fromK = 1 - bars.slice(0, k).reduce((a, b) => a + b, 0);

  return (
    <QuestionCard
      id="q1"
      tag="Questão 1 · Distribuição Binomial"
      title="Equipamentos com defeito"
      prompt={
        <>
          Cada equipamento tem probabilidade <code>p = 0,02</code> de apresentar defeito, de forma
          independente. Mexa em <strong>n</strong>, <strong>p</strong> e <strong>k</strong> e veja a
          probabilidade mudar ao vivo.
        </>
      }
    >
      <div className="controls">
        <Slider label="n (equipamentos)" value={n} min={1} max={30} onChange={(v) => { setN(v); setK(Math.min(k, v)); }} />
        <Slider label="p (defeito)" value={p} min={0.01} max={0.5} step={0.01} display={fmt(p, 2)} onChange={setP} />
        <Slider label="k (sucessos)" value={k} min={0} max={n} onChange={setK} />
      </div>

      <DistributionBars values={bars} markIndex={k} hotIndexes={k === 0 ? [0] : [0, k]} labels={['0', `${n}`]} />

      <div className="results">
        <Stat label="P(X = k)" value={fmt(atK, 6)} hint={sci(atK)} highlight />
        <Stat label="P(X ≤ k)" value={fmt(upToK, 4)} hint={`${fmt(upToK * 100, 2)}%`} />
        <Stat label="P(X ≥ k)" value={fmt(fromK, 4)} hint={`${fmt(fromK * 100, 2)}%`} />
      </div>

      <Reveal
        steps={[
          <>Reconhecer Binomial: <strong>n</strong> tentativas fixas, dois resultados (defeito / sem defeito), probabilidade constante e independência.</>,
          <>Item (a): <span className="formula-inline">P(X = 3) = C(3,3)·0,02³·0,98⁰ = 0,000008</span> — cerca de 0,0008%.</>,
          <>Item (b): probabilidade tão pequena é praticamente incompatível com “só variabilidade aleatória”; a taxa real de defeitos deve ser maior.</>,
          <>Item (c): o atalho é o complementar, <span className="formula-inline">P(X ≥ 1) = 1 − P(X = 0) = 1 − 0,98²⁰</span>.</>,
        ]}
        answer={
          <>
            (a) <strong>0,000008</strong> (0,0008%) · (b) não concordo com o gestor — o evento é raro
            demais · (c) <strong>0,3324</strong> (33,24%).
          </>
        }
      />
    </QuestionCard>
  );
}

function PoissonLab() {
  const [lambda, setLambda] = useState(4);
  const [k, setK] = useState(4);

  useEffect(() => {
    setSceneParams({ lambda });
  }, [lambda]);

  const maxK = Math.max(15, Math.ceil(lambda * 3) + 1);
  const bars = useMemo(() => Array.from({ length: maxK + 1 }, (_, i) => dpois(i, lambda)), [lambda, maxK]);
  const atK = dpois(k, lambda);
  const fromK = 1 - bars.slice(0, k).reduce((a, b) => a + b, 0);
  const oneIn = fromK > 0 ? Math.round(1 / fromK) : Infinity;

  return (
    <QuestionCard
      id="q2"
      tag="Questão 2 · Distribuição de Poisson"
      title="Admissões por hora na maternidade"
      prompt={
        <>
          O número de admissões por hora segue Poisson com média <strong>λ</strong>. Ajuste λ e o
          limiar <strong>k</strong> para investigar se 14 admissões em uma hora é mesmo “erro de registro”.
        </>
      }
    >
      <div className="controls">
        <Slider label="λ (admissões/hora)" value={lambda} min={0.5} max={12} step={0.5} display={fmt(lambda, 1)} onChange={setLambda} />
        <Slider label="k (limiar)" value={k} min={0} max={25} onChange={setK} />
      </div>

      <DistributionBars values={bars.slice(0, 26)} markIndex={k} hotIndexes={k === 0 ? [0] : [0, k]} labels={['0', '25']} />

      <div className="results">
        <Stat label="P(X = k)" value={fmt(atK, 6)} hint={sci(atK)} highlight />
        <Stat label="P(X ≥ k)" value={fmt(fromK, 8)} hint={sci(fromK)} />
        <Stat label="1 a cada" value={Number.isFinite(oneIn) ? `${oneIn.toLocaleString('pt-BR')} h` : '—'} hint="horas esperadas" />
        <Stat label="Esperado em 8760 h" value={fmt(fromK * 8760, 2)} hint="horas por ano" />
      </div>

      <Reveal
        steps={[
          <>Poisson = contar eventos raros num intervalo, com média λ e eventos independentes.</>,
          <>Item (a): <span className="formula-inline">P(X = 4) = e⁻⁴·4⁴/4! ≈ 0,1954</span>.</>,
          <>Item (b): <span className="formula-inline">P(X = 14) ≈ 5,64×10⁻⁵</span> e <span className="formula-inline">P(X ≥ 14) ≈ 7,63×10⁻⁵</span>.</>,
          <>Em 8.760 horas do ano, o esperado é <span className="formula-inline">8760 × 7,63×10⁻⁵ ≈ 0,67</span> — ~1 vez a cada 1,5 ano.</>,
        ]}
        answer={
          <>
            Um único caso extremo é compatível com a variabilidade do processo: a raridade, sozinha,
            <strong> não prova</strong> erro de registro. Vale conferir, mas seria exagero afirmar que houve erro.
          </>
        }
      />
    </QuestionCard>
  );
}

function NormalLab() {
  // μ e σ moram no **store**, não em `useState`: são os únicos parâmetros que a
  // cena 3D também mexe (o histograma é arrastável), e com duas cópias a tela
  // mostrava dois "μ" diferentes ao mesmo tempo — o card parado enquanto a curva
  // andava. O store é a fonte única: o slider escreve nele e a cena o lê.
  const { mu, sigma } = useSceneParams();
  const [x1, setX1] = useState(2500);
  const [x2, setX2] = useState(3000);
  const [x3, setX3] = useState(4000);

  const z1 = (x1 - mu) / sigma;
  const pBelow = pnorm(x1, mu, sigma);
  // x₂ e x₃ são sliders separados: um intervalo vazio (x₂ > x₃) é probabilidade
  // zero, nunca negativa
  const pBetween = Math.max(0, pnorm(x3, mu, sigma) - pnorm(x2, mu, sigma));
  const expected = pBelow * 8000;

  return (
    <QuestionCard
      id="q3"
      tag="Questão 3 · Distribuição Normal"
      title="Peso ao nascer"
      prompt={
        <>
          Peso ao nascer aproximado por Normal(μ; σ), com μ e σ em gramas. O truque é sempre o mesmo:
          <strong> padronizar</strong> (z = (x − μ)/σ) e consultar a Normal padrão.
        </>
      }
    >
      <div className="controls">
        <Slider label="μ (g)" value={mu} min={2500} max={4000} step={50} display={`${mu} g`} onChange={(v) => setSceneParams({ mu: v })} />
        <Slider label="σ (g)" value={sigma} min={100} max={800} step={50} display={`${sigma} g`} onChange={(v) => setSceneParams({ sigma: v })} />
        <Slider label="x₁ (limite inferior)" value={x1} min={1500} max={4500} step={50} display={`${x1} g`} onChange={setX1} />
        <Slider label="x₂ / x₃ (intervalo)" value={x2} min={1500} max={4500} step={50} display={`${x2} g`} onChange={setX2} />
        <Slider label="x₃ (limite superior)" value={x3} min={1500} max={4500} step={50} display={`${x3} g`} onChange={setX3} />
      </div>

      <div className="results">
        <Stat label="z de x₁" value={fmt(z1, 2)} hint="padronização" />
        <Stat label="P(X < x₁)" value={fmt(pBelow, 4)} hint={`${fmt(pBelow * 100, 2)}%`} highlight />
        <Stat label="P(x₂ < X < x₃)" value={fmt(pBetween, 4)} hint={`${fmt(pBetween * 100, 2)}%`} />
        <Stat label="Esperado em 8000" value={fmt(expected, 2)} hint={`≈ ${Math.round(expected)} nascidos`} />
      </div>

      <Reveal
        steps={[
          <>Padronize: <span className="formula-inline">z = (x − μ)/σ</span> transforma qualquer Normal em Normal padrão.</>,
          <>Item (a): <span className="formula-inline">z = (2500 − 3250)/500 = −1,5 → P = 0,0668</span>.</>,
          <>Item (b): <span className="formula-inline">z₁ = −0,5 e z₂ = 1,5 → 0,9332 − 0,3085 = 0,6247</span>.</>,
          <>Item (c): <span className="formula-inline">8000 × 0,0668 = 534,46</span>.</>,
        ]}
        answer={
          <>
            (a) <strong>0,0668</strong> (6,68%) · (b) <strong>0,6247</strong> (62,47%) · (c){' '}
            <strong>≈ 534</strong> recém-nascidos por ano.
          </>
        }
      />
    </QuestionCard>
  );
}

export function ProbabilityLab() {
  return (
    <LabSection
      id="probabilidade"
      eyebrow="Parte 1 · Probabilidade"
      title="A mesma lógica, três distribuições"
      intro="Antes de calcular, reconheça o modelo. Ajuste os parâmetros nos sliders: os números são recalculados em tempo real com as mesmas funções usadas no R."
      items={ITEMS}
    >
      <BinomialLab />
      <PoissonLab />
      <NormalLab />
    </LabSection>
  );
}
