/**
 * 2. **Histograma 3D + curva normal**.
 *
 * As barras nascem do chão (altura = densidade) e a curva normal passa por cima
 * delas. Arrastar muda **μ** (horizontal) e **σ** (vertical) em tempo real — e
 * como o arrasto publica no estado da cena (`scene/store`), o quadro de fundo da
 * página espelha o mesmo movimento. É a unificação conteúdo ↔ animação do
 * projeto, agora também em 3D.
 */

import * as THREE from 'three';
import { clamp } from './math';
import { createChalkSprite } from './chalkText';
import { createFloatingFormula, type FloatingFormula } from './formulas';
import { chalkLine, disposeObject } from './shared';
import { setSceneParams } from '../store';
import type { BuildContext, Exhibit, Frame, Readout } from './types';

const BINS = 11;
/** janela em unidades de σ (de −3,2σ a +3,2σ) */
const Z_MIN = -3.2;
const Z_MAX = 3.2;
const BIN_W = (Z_MAX - Z_MIN) / BINS;
const BAR_DEPTH = 1.5;
const MAX_HEIGHT = 2.5;
/** σ de referência: dá a altura do pico (≈ 1/σ, o ponto pedagógico) */
const SIGMA_REF = 0.7;
const CURVE_SAMPLES = 72;

/** Domínio dos sliders do laboratório Normal (gramas) — o arrasto respeita. */
const MU_RANGE: [number, number] = [2500, 4000];
const SIGMA_RANGE: [number, number] = [100, 800];

export function createHistogramExhibit(ctx: BuildContext): Exhibit {
  const { palette } = ctx;
  const group = new THREE.Group();

  // ---- chão de giz ----
  const floor = chalkLine(
    [
      [Z_MIN - 0.4, 0, BAR_DEPTH / 2 + 0.35],
      [Z_MAX + 0.4, 0, BAR_DEPTH / 2 + 0.35],
    ],
    palette.chalk,
    0.85,
  );
  group.add(floor);

  // ---- barras ----
  const barGeometry = new THREE.BoxGeometry(1, 1, 1);
  const bars: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>> = [];
  for (let i = 0; i < BINS; i += 1) {
    const tone = [palette.blue, palette.cyan, palette.orange][i % 3];
    const bar = new THREE.Mesh(
      barGeometry,
      new THREE.MeshStandardMaterial({
        color: tone,
        roughness: 0.55,
        metalness: 0.1,
        transparent: true,
        opacity: 0.86,
        emissive: new THREE.Color(tone),
        emissiveIntensity: 0.14,
      }),
    );
    bar.castShadow = true;
    bar.position.set(Z_MIN + (i + 0.5) * BIN_W, 0, 0);
    group.add(bar);
    bars.push(bar);
  }

  // ---- curva normal (fita atualizada no lugar: sem alocar geometria por quadro) ----
  const curvePositions = new Float32Array(CURVE_SAMPLES * 2 * 3);
  const curveIndices: number[] = [];
  for (let i = 0; i < CURVE_SAMPLES - 1; i += 1) {
    const a = i * 2;
    curveIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const curveGeometry = new THREE.BufferGeometry();
  curveGeometry.setAttribute('position', new THREE.BufferAttribute(curvePositions, 3));
  curveGeometry.setIndex(curveIndices);
  const curve = new THREE.Mesh(
    curveGeometry,
    new THREE.MeshBasicMaterial({
      color: palette.red,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    }),
  );
  group.add(curve);

  // ---- guia da média ----
  const meanGuide = chalkLine(
    [
      [0, 0, -BAR_DEPTH / 2 - 0.25],
      [0, 1, -BAR_DEPTH / 2 - 0.25],
    ],
    palette.yellow,
    0.9,
  );
  group.add(meanGuide);

  // ---- rótulos do eixo ----
  const tick = (label: string, x: number, color: string) => {
    const { sprite, plate } = createChalkSprite([{ text: label, size: 44, color }], {
      worldHeight: 0.3,
    });
    ctx.plates.push(plate);
    sprite.position.set(x, 0.22, BAR_DEPTH / 2 + 0.75);
    group.add(sprite);
    return { sprite, plate };
  };
  const axisTicks = [
    tick('−3σ', Z_MIN, palette.chalk),
    tick('μ', 0, palette.yellow),
    tick('+3σ', Z_MAX, palette.chalk),
  ];

  // ---- fórmulas flutuantes (as do quadro: f(x), Z, H₀, t) ----
  const formulas: FloatingFormula[] = [
    createFloatingFormula(ctx, {
      text: 'f(x) = 1/(σ√2π)·e^{−(x−μ)²/(2σ²)}',
      color: palette.cyan,
      position: [-2.2, 3.6, 0],
      height: 0.46,
      seed: 5,
    }),
    createFloatingFormula(ctx, {
      text: 'Z = (X − μ)/σ',
      color: palette.orange,
      position: [2.4, 3.4, 0.3],
      height: 0.5,
      seed: 17,
    }),
    createFloatingFormula(ctx, {
      text: 'H_{0}: μ = μ_{0}   ×   H_{1}: μ ≠ μ_{0}',
      color: palette.blue,
      position: [-1.4, -1.1, 0.6],
      height: 0.36,
      seed: 29,
    }),
    createFloatingFormula(ctx, {
      text: 't = (\\bar{x} − μ_{0})/(s/√n)',
      color: palette.pink,
      position: [1.8, -1.2, 0.6],
      height: 0.4,
      seed: 41,
    }),
  ];
  formulas.forEach((f) => group.add(f.sprite));

  // ---- estado ----
  let mu = clamp(ctx.params.mu, MU_RANGE[0], MU_RANGE[1]);
  let sigma = clamp(ctx.params.sigma, SIGMA_RANGE[0], SIGMA_RANGE[1]);
  let dragged = false;
  let selectedBin = -1;

  /** μ em unidades de σ (a curva anda dentro da janela fixa). */
  const muZ = () => clamp(((mu - 3250) / 500) * 0.9, -1.4, 1.4);
  /** σ normalizado e limitado: mantém o pico entre 1,1 e 2,9. */
  const sigmaZ = () => clamp(sigma / 500, 0.6, 1.6);
  /** Altura da densidade em z (tudo em unidades de σ) — pico = max·σ_ref/σ. */
  const heightAt = (z: number, mz: number, sz: number) => {
    const bell = Math.exp(-0.5 * ((z - mz) / sz) ** 2);
    return MAX_HEIGHT * (SIGMA_REF / sz) * bell;
  };

  const update = (frame: Frame) => {
    // o estado compartilhado manda (arrasto e sliders do laboratório convivem)
    if (!dragged) {
      mu = clamp(frame.params.mu, MU_RANGE[0], MU_RANGE[1]);
      sigma = clamp(frame.params.sigma, SIGMA_RANGE[0], SIGMA_RANGE[1]);
    }
    dragged = false;

    const mz = muZ();
    const sz = sigmaZ();

    bars.forEach((bar, i) => {
      const z = Z_MIN + (i + 0.5) * BIN_W;
      const jitter = frame.playing ? 1 + 0.02 * Math.sin(frame.t * 2.2 + i * 1.7) : 1;
      const height = Math.max(0.04, heightAt(z, mz, sz) * jitter);
      bar.scale.set(BIN_W - 0.07, height, BAR_DEPTH);
      bar.position.y = height / 2;
      bar.material.opacity = 0.72 + 0.16 * frame.focus;
      // a classe escolhida no clique fica acesa
      const chosen = i === selectedBin;
      bar.material.emissiveIntensity = chosen ? 0.5 + 0.2 * Math.sin(frame.t * 3.5) : 0.14;
    });

    // fita da curva: só reescreve as posições, nunca realoca
    const array = curveGeometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < CURVE_SAMPLES; i += 1) {
      const z = Z_MIN + ((Z_MAX - Z_MIN) * i) / (CURVE_SAMPLES - 1);
      const y = Math.max(0.05, heightAt(z, mz, sz));
      array.setXYZ(i * 2, z, y, -0.09);
      array.setXYZ(i * 2 + 1, z, y, 0.09);
    }
    array.needsUpdate = true;
    curveGeometry.computeBoundingSphere();

    meanGuide.position.x = mz;
    meanGuide.scale.y = Math.max(0.2, heightAt(mz, mz, sz));
    axisTicks[1].sprite.position.x = mz;

    formulas.forEach((f) => f.update(frame.t));
  };

  const readout = (): Readout[] => {
    const rows: Readout[] = [
      { label: 'μ (média)', value: `${Math.round(mu)} g` },
      { label: 'σ (desvio)', value: `${Math.round(sigma)} g` },
      { label: 'Pico ∝ 1/σ', value: (MAX_HEIGHT * (SIGMA_REF / sigmaZ())).toFixed(2) },
      { label: 'Bins', value: String(BINS) },
      { label: 'P(μ−σ < X < μ+σ)', value: '68,3%' },
    ];
    if (selectedBin >= 0) {
      const z = Z_MIN + (selectedBin + 0.5) * BIN_W;
      rows.push({
        label: `Classe ${selectedBin + 1}`,
        value: `${Math.round(mu + z * sigma)} g (z = ${z.toFixed(2)})`,
      });
    }
    return rows;
  };

  return {
    id: 'histograma',
    title: 'Histograma 3D + Normal',
    tagline: 'Arraste na horizontal para mudar μ; na vertical, σ',
    formula: 'f(x) = 1/(σ√2π)·e^{−(x−μ)²/(2σ²)}',
    explanation:
      'As barras são a densidade da Normal amostrada em 11 classes e a curva vermelha é a mesma função contínua. Arraste para ver o efeito de cada parâmetro: mexer em μ desloca a curva, mexer em σ achata ou afina. A área total continua 1.',
    camera: [0, 2.8, 9.6],
    lookAtY: 1.3,
    drag: 'params',
    group,
    selectables: bars,
    onDrag(dx, dy) {
      // dx/dy vêm normalizados: uma “tela inteira” de arrasto cobre a faixa toda
      mu = clamp(mu + dx * 700, MU_RANGE[0], MU_RANGE[1]);
      sigma = clamp(sigma - dy * 620, SIGMA_RANGE[0], SIGMA_RANGE[1]);
      dragged = true;
      // ponte com o quadro de fundo: o conteúdo (μ/σ) alimenta a animação
      setSceneParams({ mu: Math.round(mu), sigma: Math.round(sigma) });
    },
    onPick(hit) {
      const index = bars.indexOf(hit.object as (typeof bars)[number]);
      if (index < 0) return null;
      selectedBin = selectedBin === index ? -1 : index;
      if (selectedBin < 0) return null;
      const z = Z_MIN + (selectedBin + 0.5) * BIN_W;
      const from = Math.round(mu + (z - BIN_W / 2) * sigma);
      const to = Math.round(mu + (z + BIN_W / 2) * sigma);
      return `Classe ${selectedBin + 1}: de ${from} g a ${to} g (z de ${(z - BIN_W / 2).toFixed(2)} a ${(z + BIN_W / 2).toFixed(2)}) · densidade no centro ${heightAt(z, muZ(), sigmaZ()).toFixed(2)}`;
    },
    update,
    readout,
    reset() {
      mu = ctx.params.mu;
      sigma = ctx.params.sigma;
      selectedBin = -1;
      setSceneParams({ mu: ctx.params.mu, sigma: ctx.params.sigma });
    },
    dispose() {
      disposeObject(group);
    },
  };
}
