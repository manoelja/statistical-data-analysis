import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * Fundo em três camadas (denso, como o quadro-negro de referência):
 *
 * 1. Aurora  — manchas difusas nas cores do tema (CSS puro, movimento lento)
 * 2. Doodles — dezenas de fórmulas/diagramas científicos em SVG com filtro de
 *              giz (feTurbulence + feDisplacementMap), cobrindo a tela toda
 *              (sem máscara central — a referência é densa de borda a borda);
 *              a cor vem das variáveis do tema, não da coloração da imagem
 * 3. Grão    — ruído estático (data-URI SVG) para textura de superfície
 *
 * Parallax único (uma camada) via useScroll. `prefers-reduced-motion` desliga
 * a deriva da aurora automaticamente.
 */

/* ---------- utilidades de desenho ---------- */

/** Caminho de uma curva normal centrada em cx, desvio sd (unidades do viewBox). */
function bellPath(cx: number, sd: number, h: number, w: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * w;
    const y = h - h * Math.exp(-((x - cx) ** 2) / (2 * sd * sd));
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

/** Espiral de galáxia. */
function spiralPath(cx: number, cy: number, turns: number, rMax: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    const a = t * turns * Math.PI * 2;
    const r = t * rMax;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

const T = ({ x, y, children, size = 15 }: { x: number; y: number; children: string; size?: number }) => (
  <text x={x} y={y} className="chalk-doodle__text" style={{ fontSize: size }}>
    {children}
  </text>
);

/* ---------- doodles (referência: fórmulas + diagramas de todas as ciências) ---------- */

interface Doodle {
  x: number;
  y: number;
  rot: number;
  w: number;
  node: React.ReactNode;
}

const DOODLES: Doodle[] = [
  /* ============ faixa superior ============ */
  // curva normal μ±σ
  { x: 2, y: 3, rot: -3, w: 200, node: (
    <>
      <path d={bellPath(100, 32, 66, 200)} />
      <path d="M100 6 V72" strokeDasharray="4 5" />
      <path d="M68 36 V72 M132 36 V72" strokeDasharray="3 5" />
      <T x={103} y={16}>μ</T>
      <T x={44} y={46}>μ−σ</T>
      <T x={137} y={46}>μ+σ</T>
    </>
  )},
  // parábola em coord.
  { x: 19, y: 2, rot: 2, w: 150, node: (
    <>
      <path d="M12 70 H142 M30 76 V8" />
      <path d="M40 20 Q85 92 132 20" />
      <T x={126} y={16}>x</T>
      <T x={16} y={16}>y</T>
    </>
  )},
  // fórmula binomial
  { x: 34, y: 4, rot: -2, w: 250, node: <T x={0} y={26} size={17}>P(X=k) = C(n,k)·pᵏ(1−p)ⁿ⁻ᵏ</T> },
  // circuito elétrico
  { x: 57, y: 2, rot: 3, w: 170, node: (
    <>
      <rect x="6" y="14" width="150" height="48" rx="4" />
      <path d="M6 30 H30 M50 30 H80 M100 30 H132" />
      <path d="M30 22 l6 16 l6 -16 l6 16 l6 -16" />
      <circle cx="90" cy="30" r="10" />
      <path d="M146 46 l-8 -8 M146 46 l8 -8" />
      <T x={62} y={58}>I</T>
    </>
  )},
  // E = mc²
  { x: 78, y: 4, rot: -4, w: 130, node: <T x={0} y={30} size={22}>E = mc²</T> },
  // átomo
  { x: 90, y: 8, rot: 2, w: 130, node: (
    <>
      <circle cx="65" cy="37" r="7" />
      <ellipse cx="65" cy="37" rx="58" ry="20" />
      <ellipse cx="65" cy="37" rx="58" ry="20" transform="rotate(60 65 37)" />
      <ellipse cx="65" cy="37" rx="58" ry="20" transform="rotate(120 65 37)" />
    </>
  )},

  /* ============ faixa 2 ============ */
  // seno
  { x: 3, y: 17, rot: 2, w: 170, node: (
    <>
      <path d="M4 40 Q26 6 48 40 T92 40 T136 40 T176 40" />
      <T x={140} y={58}>sin x</T>
    </>
  )},
  // razão P(x)/Q(x)
  { x: 17, y: 20, rot: -3, w: 190, node: <T x={0} y={26} size={16}>P(x)/Q(x) = G(x)+R(x)</T> },
  // sistema de coordenadas com círculo
  { x: 33, y: 16, rot: 2, w: 140, node: (
    <>
      <path d="M70 4 V70 M10 37 H134" />
      <circle cx="70" cy="37" r="26" />
      <path d="M70 37 L96 19" strokeDasharray="3 4" />
      <T x={100} y={18}>(x,y)</T>
    </>
  )},
  // Σ / somatório
  { x: 47, y: 19, rot: -2, w: 130, node: <T x={0} y={34} size={26}>Σ(xᵢ−x̄)²</T> },
  // proveta
  { x: 58, y: 16, rot: 4, w: 70, node: (
    <>
      <path d="M14 6 H42 M20 6 V52 Q20 64 28 64 Q36 64 36 52 V6" />
      <path d="M20 40 H36" />
      <circle cx="28" cy="50" r="3" />
      <circle cx="23" cy="57" r="2" />
    </>
  )},
  // algarismos romanos (cromossomo)
  { x: 68, y: 14, rot: -3, w: 90, node: (
    <>
      <path d="M14 10 Q26 37 14 64 M34 10 Q22 37 34 64 M28 10 Q40 37 28 64" />
      <T x={2} y={74}>X</T>
    </>
  )},
  // √(p̂(1−p̂)/n)
  { x: 79, y: 20, rot: 2, w: 210, node: <T x={0} y={26} size={16}>√(p̂(1−p̂)/n)</T> },
  // molécula (anel benzeno)
  { x: 92, y: 30, rot: -2, w: 110, node: (
    <>
      <path d="M55 8 L88 27 L88 53 L55 72 L22 53 L22 27 Z" />
      <circle cx="55" cy="40" r="17" />
    </>
  )},

  /* ============ faixa 3 (meio) ============ */
  // log
  { x: 2, y: 33, rot: -2, w: 175, node: <T x={0} y={26} size={16}>logₙ m = log m / log n</T> },
  // cone geométrico
  { x: 14, y: 30, rot: 3, w: 120, node: (
    <>
      <ellipse cx="60" cy="60" rx="48" ry="14" />
      <path d="M12 60 L60 6 L108 60" />
      <path d="M60 6 V60" strokeDasharray="4 5" />
      <T x={64} y={40}>h</T>
    </>
  )},
  // dP/dt = ...
  { x: 26, y: 38, rot: -3, w: 180, node: <T x={0} y={26} size={16}>E = −ΔQ / Δt</T> },
  // DNA
  { x: 40, y: 33, rot: 2, w: 110, node: (
    <>
      <path d="M18 4 Q54 24 18 44 Q54 64 18 84" />
      <path d="M54 4 Q18 24 54 44 Q18 64 54 84" />
      <path d="M24 14 H48 M22 34 H50 M24 54 H48 M22 74 H50" />
    </>
  )},
  // H₀ / teste
  { x: 52, y: 36, rot: -2, w: 200, node: <T x={0} y={26} size={16}>H₀: μ = 7  vs  H₁: μ ≠ 7</T> },
  // humano (silhueta simples)
  { x: 64, y: 31, rot: 2, w: 80, node: (
    <>
      <circle cx="40" cy="14" r="11" />
      <path d="M40 25 V56 M40 32 L20 46 M40 32 L60 46 M40 56 L26 84 M40 56 L54 84" />
    </>
  )},
  // fórmula química
  { x: 74, y: 40, rot: -3, w: 210, node: <T x={0} y={26} size={15}>2C₃H₅O₃ + 2Co</T> },
  // neuronômio / estrela
  { x: 90, y: 48, rot: 3, w: 90, node: (
    <>
      <circle cx="45" cy="37" r="10" />
      <path d="M45 27 V6 M45 47 V68 M35 37 H10 M55 37 H80 M38 30 L20 14 M52 30 L70 14 M38 44 L20 60 M52 44 L70 60" />
    </>
  )},

  /* ============ faixa 4 ============ */
  // nuvem de pontos + regressão
  { x: 2, y: 47, rot: 2, w: 160, node: (
    <>
      <path d="M8 64 L144 14" strokeDasharray="6 6" />
      <circle cx="22" cy="56" r="3.4" />
      <circle cx="46" cy="48" r="3.4" />
      <circle cx="62" cy="54" r="3.4" />
      <circle cx="80" cy="36" r="3.4" />
      <circle cx="100" cy="40" r="3.4" />
      <circle cx="118" cy="24" r="3.4" />
      <path d="M8 8 H8 V70 H152" />
    </>
  )},
  // hexágono químico
  { x: 15, y: 54, rot: -2, w: 120, node: (
    <>
      <path d="M60 8 L94 30 L94 62 L60 84 L26 62 L26 30 Z" />
      <path d="M60 20 L84 36 L84 56 L60 72 L36 56 L36 36 Z" />
    </>
  )},
  // integral
  { x: 28, y: 52, rot: 3, w: 140, node: (
    <>
      <T x={0} y={34} size={26}>∫ f(x) dx</T>
      <T x={0} y={58} size={13}>= 1</T>
    </>
  )},
  // Venn
  { x: 40, y: 56, rot: -2, w: 150, node: (
    <>
      <circle cx="52" cy="40" r="30" />
      <circle cx="96" cy="40" r="30" />
      <T x={30} y={45} size={17}>A</T>
      <T x={104} y={45} size={17}>B</T>
    </>
  )},
  // histograma
  { x: 54, y: 52, rot: 2, w: 150, node: (
    <>
      <rect x="6" y="46" width="20" height="26" />
      <rect x="30" y="32" width="20" height="40" />
      <rect x="54" y="16" width="20" height="56" />
      <rect x="78" y="24" width="20" height="48" />
      <rect x="102" y="40" width="20" height="32" />
      <rect x="126" y="54" width="20" height="18" />
      <path d="M2 74 H152" />
    </>
  )},
  // fórmula de massa molar
  { x: 68, y: 58, rot: -3, w: 190, node: <T x={0} y={26} size={15}>SiCl₄ · Al₂(SO₄)₃</T> },
  // galáxia espiral
  { x: 86, y: 64, rot: 2, w: 140, node: (
    <>
      <path d={spiralPath(70, 40, 2, 62)} />
      <path d={spiralPath(70, 40, 2, 62)} transform="rotate(180 70 40)" />
      <circle cx="70" cy="40" r="5" />
    </>
  )},

  /* ============ faixa 5 ============ */
  // z = (x̄−μ)/(s/√n)
  { x: 3, y: 68, rot: -2, w: 220, node: <T x={0} y={26} size={16}>z = (x̄ − μ₀) / (s/√n)</T> },
  // planetas com anel
  { x: 18, y: 74, rot: 2, w: 120, node: (
    <>
      <circle cx="58" cy="40" r="24" />
      <ellipse cx="58" cy="40" rx="52" ry="14" transform="rotate(-18 58 40)" />
    </>
  )},
  // x̄ ± t·s/√n
  { x: 30, y: 66, rot: 3, w: 230, node: <T x={0} y={26} size={17}>x̄ ± t₀,₉₇₅ · s/√n</T> },
  // Erlenmeyer
  { x: 44, y: 72, rot: -2, w: 90, node: (
    <>
      <path d="M30 6 H58 M36 6 V30 L14 74 Q10 84 20 84 H68 Q78 84 74 74 L52 30 V6" />
      <path d="M20 58 H68" />
      <circle cx="38" cy="68" r="4" />
      <circle cx="52" cy="64" r="3" />
    </>
  )},
  // λ = 4 (poisson)
  { x: 54, y: 74, rot: -3, w: 160, node: (
    <>
      <path d="M6 44 L26 20 L46 38 L66 12 L86 32 L106 24 L126 48" />
      <path d="M4 54 H140" strokeDasharray="3 6" />
      <T x={98} y={72}>λ = 4</T>
    </>
  )},
  // fórmula binomial grande (parte inferior)
  { x: 66, y: 72, rot: 2, w: 240, node: <T x={0} y={26} size={15}>p̂ = 186/200 = 0,93</T> },
  // árvores / dendrítica
  { x: 84, y: 78, rot: -2, w: 130, node: (
    <>
      <path d="M65 76 V52 M65 52 L34 28 M65 52 L96 28 M34 28 L18 12 M34 28 L44 8 M96 28 L112 12 M96 28 L86 8" />
      <circle cx="65" cy="80" r="5" />
    </>
  )},

  /* ============ base ============ */
  // IC da proporção
  { x: 2, y: 86, rot: 2, w: 250, node: <T x={0} y={26} size={16}>p̂ ± 1,96 · √(p̂q̂/n)</T> },
  // frasco de destilação
  { x: 22, y: 90, rot: -2, w: 100, node: (
    <>
      <circle cx="50" cy="52" r="28" />
      <path d="M50 24 V4 M36 6 H64 M50 80 Q50 88 42 88" />
      <path d="M32 44 Q50 34 68 44" />
    </>
  )},
  // porcentagem
  { x: 36, y: 88, rot: 3, w: 110, node: <T x={0} y={34} size={28}>95%</T> },
  // gerador / fórmula V=IR
  { x: 48, y: 92, rot: -2, w: 170, node: <T x={0} y={26} size={16}>V = I · R</T> },
  // micro-ondas / onda
  { x: 63, y: 88, rot: 2, w: 150, node: (
    <>
      <path d="M4 34 Q22 6 40 34 T76 34 T112 34" />
      <path d="M4 46 H130" strokeDasharray="4 6" />
    </>
  )},
  // célula / organela
  { x: 78, y: 90, rot: -3, w: 110, node: (
    <>
      <circle cx="55" cy="40" r="34" />
      <circle cx="46" cy="34" r="12" />
      <path d="M70 52 Q80 44 74 34" />
    </>
  )},
  // α = 0,05
  { x: 92, y: 88, rot: 2, w: 120, node: <T x={0} y={28} size={17}>α = 0,05</T> },
];

export function ChalkDoodles() {
  const { scrollYProgress } = useScroll();
  // Parallax único e discreto: as doodles escorregam levemente ao rolar.
  const y = useTransform(scrollYProgress, [0, 1], [-24, 24]);

  return (
    <div className="chalk-bg" aria-hidden="true">
      {/* 1 — aurora */}
      <div className="chalk-bg__aurora" />

      {/* 2 — doodles de giz (denso, borda a borda) */}
      <motion.div className="chalk-bg__doodles" style={{ y }}>
        <svg width="0" height="0" className="chalk-bg__defs" focusable="false" aria-hidden="true">
          <defs>
            <filter id="chalk-rough" x="-15%" y="-15%" width="130%" height="130%">
              <feTurbulence type="fractalNoise" baseFrequency="0.045 0.06" numOctaves={3} seed={7} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={4} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>

        {DOODLES.map((d, i) => (
          <svg
            key={i}
            className="chalk-doodle"
            viewBox="0 0 160 90"
            width={d.w}
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              transform: `rotate(${d.rot}deg)`,
            }}
            focusable="false"
          >
            <g filter="url(#chalk-rough)">{d.node}</g>
          </svg>
        ))}
      </motion.div>

      {/* 3 — grão */}
      <div className="chalk-bg__grain" />
    </div>
  );
}