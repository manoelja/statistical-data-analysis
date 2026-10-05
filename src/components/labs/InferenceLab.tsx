import { useState } from 'react';
import { LabSection } from '../lab/LabSection';
import { QuestionCard } from '../lab/QuestionCard';
import { NumberField, Reveal, Slider, Stat } from '../lab/Controls';
import { fmt, meanConfidenceInterval, oneProportionZ, oneSampleT, proportionConfidenceInterval, sci } from '../../lib/stats';
import { apgar, dataset, peso } from '../../data/results';

const ITEMS = [
  { id: 'q4', short: 'Média (APGAR)' },
  { id: 'q5', short: 'Proporção (peso)' },
];

function alphaDisplay(alpha: number) {
  return `IC ${fmt((1 - alpha) * 100, 0)}%`;
}

function MeanLab() {
  const [xbar, setXbar] = useState<number>(apgar.xbar);
  const [s, setS] = useState<number>(apgar.s);
  const [n, setN] = useState<number>(dataset.apgarValidos);
  const [mu0, setMu0] = useState<number>(apgar.mu0);
  const [alpha, setAlpha] = useState(0.05);

  const valid = n > 1 && s > 0;
  const ic = valid ? meanConfidenceInterval(xbar, s, n, alpha) : null;
  const test = valid ? oneSampleT(xbar, s, n, mu0) : null;
  const covers = ic ? mu0 >= ic.lower && mu0 <= ic.upper : false;

  return (
    <QuestionCard
      id="q4"
      tag="Questão 4 · Inferência para a média"
      title="Média populacional do APGAR1"
      prompt={
        <>
          Os valores começam com a estatística real da amostra (n = 198 após excluir o código 99 e
          faltantes). Altere os campos e veja o intervalo de confiança <em>t</em> e o teste responderem.
        </>
      }
    >
      <div className="controls">
        <NumberField label="x̄ (média amostral)" value={xbar} step={0.0001} onChange={setXbar} />
        <NumberField label="s (desvio-padrão)" value={s} step={0.0001} onChange={setS} />
        <NumberField label="n (amostra)" value={n} step={1} onChange={setN} />
        <NumberField label="μ₀ (hipótese)" value={mu0} step={0.5} onChange={setMu0} />
        <Slider label="Nível de confiança" value={alpha} min={0.01} max={0.1} step={0.01} display={alphaDisplay(alpha)} onChange={setAlpha} />
      </div>

      <div className="results">
        <Stat label="erro padrão" value={ic ? fmt(ic.se, 4) : '—'} />
        <Stat label={`t crítico (gl ${n - 1})`} value={ic ? fmt(ic.tCrit, 4) : '—'} />
        <Stat label="IC" value={ic ? `[${fmt(ic.lower, 4)}; ${fmt(ic.upper, 4)}]` : '—'} highlight />
        <Stat label="estatística t" value={test ? fmt(test.t, 4) : '—'} />
        <Stat label="p-valor" value={test ? sci(test.p) : '—'} hint={test ? `H₀: μ = ${fmt(mu0, 2)}` : undefined} />
      </div>

      <p className="qcard__prompt">
        {test
          ? test.p < alpha
            ? `Como p ${'<'} α = ${fmt(alpha, 2)}, rejeitamos H₀ — o valor médio difere de ${fmt(mu0, 2)}.`
            : `Como p ≥ α = ${fmt(alpha, 2)}, não há evidência para rejeitar H₀.`
          : 'Informe n > 1 e s > 0 para calcular.'}
        {ic && <> · O IC {covers ? 'contém' : 'não contém'} o valor testado.</>}
      </p>

      <Reveal
        steps={[
          <>Higiene dos dados: remover o código <strong>99</strong> (“ignorado”) e os faltantes → n = 198.</>,
          <>Estimativa pontual: <span className="formula-inline">x̄ = 8,2778</span>.</>,
          <>IC 95% com t de Student: <span className="formula-inline">x̄ ± t₀,₉₇₅;₁₉₇ · s/√n = 8,2778 ± 1,9721 · 0,1032</span>.</>,
          <>Requisitos: amostra aleatória simples, n ≥ 30 (TCL) e σ populacional desconhecido (use t).</>,
          <>Teste: <span className="formula-inline">t = (8,2778 − 7)/0,1032 ≈ 12,377</span> com 197 gl e p ≈ 2,10×10⁻²⁶.</>,
        ]}
        answer={
          <>
            IC 95% = <strong>[8,0742; 8,4814]</strong> · rejeita-se H₀: μ ≠ 7 (na verdade, μ é superior a 7).
            Na base completa, μ = 8,3075 — dentro do IC.
          </>
        }
      />
    </QuestionCard>
  );
}

function ProportionLab() {
  const [x, setX] = useState<number>(peso.sucessos);
  const [n, setN] = useState<number>(peso.n);
  const [p0, setP0] = useState<number>(peso.p0);
  const [alpha, setAlpha] = useState(0.05);

  const valid = n > 0 && x >= 0 && x <= n;
  const ic = valid ? proportionConfidenceInterval(x, n, alpha) : null;
  const test = valid ? oneProportionZ(x, n, p0) : null;
  const covers = ic ? p0 >= ic.lower && p0 <= ic.upper : false;

  return (
    <QuestionCard
      id="q5"
      tag="Questão 5 · Inferência para a proporção"
      title="Proporção com peso ≥ 2.500 g"
      prompt={
        <>
          Cada recém-nascido é um “sucesso” (1) se pesa ≥ 2.500 g. Com x sucessos em n observações,
          obtemos a proporção, o IC de Wald e o teste <em>z</em>.
        </>
      }
    >
      <div className="controls">
        <NumberField label="x (sucessos)" value={x} step={1} onChange={setX} />
        <NumberField label="n (total)" value={n} step={1} onChange={setN} />
        <NumberField label="p₀ (hipótese)" value={p0} step={0.01} onChange={setP0} />
        <Slider label="Nível de confiança" value={alpha} min={0.01} max={0.1} step={0.01} display={alphaDisplay(alpha)} onChange={setAlpha} />
      </div>

      <div className="results">
        <Stat label="p̂" value={ic ? fmt(ic.phat, 4) : '—'} hint={valid ? `${x}/${n}` : undefined} highlight />
        <Stat label="erro padrão" value={ic ? fmt(ic.se, 4) : '—'} />
        <Stat label="IC" value={ic ? `[${fmt(ic.lower, 4)}; ${fmt(ic.upper, 4)}]` : '—'} />
        <Stat label="estatística z" value={test ? fmt(test.z, 4) : '—'} hint={test ? `X² = ${fmt(test.z ** 2, 4)}` : undefined} />
        <Stat label="p-valor" value={test ? fmt(test.p, 4) : '—'} hint={test ? `H₀: p = ${fmt(p0, 2)}` : undefined} />
      </div>

      <p className="qcard__prompt">
        {test && ic
          ? test.p < alpha
            ? `p ${'<'} α = ${fmt(alpha, 2)} → rejeitamos H₀: a proporção difere de ${fmt(p0, 2)}.`
            : `p ≥ α = ${fmt(alpha, 2)} → não se rejeita H₀; a diferença é compatível com a variabilidade amostral.`
          : 'Informe 0 ≤ x ≤ n.'}
        {ic && <> · O IC {covers ? 'contém' : 'não contém'} p₀.</>}
      </p>
      {valid && (
        <p className="qcard__prompt">
          Requisito de normalidade: n·p̂ = {fmt(x, 0)} e n·(1 − p̂) = {fmt(n - x, 0)} — ambos ≥ 10.
        </p>
      )}

      <Reveal
        steps={[
          <>Variável indicadora: <span className="formula-inline">Y = 1 se PESO ≥ 2500 g; 0 caso contrário</span> → 186 sucessos em 200.</>,
          <>Estimativa: <span className="formula-inline">p̂ = 186/200 = 0,93</span>.</>,
          <>IC de Wald: <span className="formula-inline">p̂ ± z₀,₉₇₅·√(p̂(1−p̂)/n) = 0,93 ± 1,96 · 0,01804</span>.</>,
          <>Teste: <span className="formula-inline">z = (0,93 − 0,90)/√(0,90·0,10/200) ≈ 1,414</span> e p ≈ 0,1573.</>,
          <>Requisitos: amostra aleatória simples, independência, n·p̂ e n(1−p̂) ≥ 10.</>,
        ]}
        answer={
          <>
            IC 95% = <strong>[0,8946; 0,9654]</strong> · não se rejeita H₀: a proporção pode ser 90%.
            Na população, p = 0,9052 (baixo peso ≈ 9,48%).
          </>
        }
      />
    </QuestionCard>
  );
}

export function InferenceLab() {
  return (
    <LabSection
      id="inferencia"
      eyebrow="Parte 2 · Inferência estatística"
      title="Dois personagens: média e proporção"
      intro="A receita é sempre a mesma — estimar, construir o intervalo, testar e comparar com a população. Aqui você controla os números e vê os requisitos e conclusões mudarem."
      items={ITEMS}
    >
      <MeanLab />
      <ProportionLab />
    </LabSection>
  );
}
