/**
 * 3. **Nuvem de dispersão 3D + plano de regressão**.
 *
 * ~50 pontos flutuando, o plano de mínimos quadrados atravessando a nuvem e a
 * cor de cada ponto dizendo o resíduo: verde = colado na reta, vermelho = longe.
 * Clicar num ponto acende o "espinho" do resíduo (o segmento até o plano) e o
 * painel mostra quanto ele está acima ou abaixo do previsto.
 *
 * A nuvem respira: os desvios oscilam devagar (como no quadro SVG), então R²
 * muda ao vivo — dá para *ver* o que o coeficiente mede.
 */

import * as THREE from 'three';
import { clamp, linearRegression, residualColor, residualOf } from './math';
import { createDotTexture } from './chalkText';
import { createFloatingFormula, type FloatingFormula } from './formulas';
import { chalkLine, disposeObject } from './shared';
import type { BuildContext, Exhibit, Frame, Readout } from './types';

const COUNT = 50;
const BASE = 2.4;
const SLOPE = 0.42;

/** vetores reaproveitados (nada de alocar dentro do laço de animação) */
const PLANE_FRONT = new THREE.Vector3(0, 0, 1);
const PLANE_NORMAL = new THREE.Vector3();
const SPIKE_FROM = new THREE.Vector3();
const SPIKE_TO = new THREE.Vector3();
const TEMP_COLOR = new THREE.Color();

export function createScatterExhibit(ctx: BuildContext): Exhibit {
  const { palette } = ctx;
  const group = new THREE.Group();

  // ---- nuvem (x, profundidade z e desvio guardado por ponto) ----
  const cloud: Array<{ x: number; z: number; dev: number; phase: number }> = [];
  for (let i = 0; i < COUNT; i += 1) {
    cloud.push({
      x: -2.9 + (5.8 * i) / (COUNT - 1) + (Math.random() - 0.5) * 0.34,
      z: (Math.random() - 0.5) * 4.4,
      dev: clamp((Math.random() * 2 - 1) * 1.35, -2.2, 2.2),
      phase: Math.random() * 6.28,
    });
  }

  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const dots = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.34,
      map: createDotTexture(palette.cyan),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  group.add(dots);

  // ---- plano de regressão ----
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 5),
    new THREE.MeshStandardMaterial({
      color: palette.yellow,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.9,
      emissive: new THREE.Color(palette.yellow),
      emissiveIntensity: 0.25,
    }),
  );
  group.add(plane);

  // ---- ponto escolhido + espinho do resíduo ----
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 20, 16),
    new THREE.MeshBasicMaterial({ color: palette.pink }),
  );
  marker.visible = false;
  group.add(marker);

  const spike = chalkLine(
    [
      [0, 0, 0],
      [0, 1, 0],
    ],
    palette.pink,
    0.95,
  );
  spike.visible = false;
  group.add(spike);

  const formulas: FloatingFormula[] = [
    createFloatingFormula(ctx, {
      text: 'ŷ = β_{0} + β_{1}x',
      color: palette.chalk,
      position: [-2.4, 5.1, 0],
      height: 0.5,
      seed: 2,
    }),
    createFloatingFormula(ctx, {
      text: 'R² = 1 − Σ(y_{i} − ŷ_{i})²/Σ(y_{i} − \\bar{y})²',
      color: palette.pink,
      position: [1.2, 5.0, 0.3],
      height: 0.4,
      seed: 13,
    }),
  ];
  formulas.forEach((f) => group.add(f.sprite));

  // ---- estado ----
  let selected = -1;
  let hovered = -1;
  let line = { b0: BASE, b1: SLOPE, r2: 0, n: COUNT };
  /** último y calculado por ponto (a leitura do painel usa o mesmo valor) */
  const lastY = new Array<number>(COUNT).fill(BASE);

  const yOf = (index: number, t: number, playing: boolean) => {
    const point = cloud[index];
    const spread = playing ? 0.45 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.32)) : 0.75;
    const wobble = playing ? 0.05 * Math.sin(t * 1.1 + point.phase) : 0;
    return BASE + SLOPE * point.x + point.dev * spread + wobble;
  };

  const update = (frame: Frame) => {
    // 1. posições e cores (o resíduo define a cor: verde perto, vermelho longe)
    const samples: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < COUNT; i += 1) {
      lastY[i] = yOf(i, frame.t, frame.playing);
      samples.push({ x: cloud[i].x, y: lastY[i] });
    }
    line = linearRegression(samples);

    const residuals = samples.map((sample) => residualOf(sample, line));
    const maxAbs = Math.max(0.35, ...residuals.map((r) => Math.abs(r)));

    for (let i = 0; i < COUNT; i += 1) {
      positions[i * 3] = cloud[i].x;
      positions[i * 3 + 1] = lastY[i];
      positions[i * 3 + 2] = cloud[i].z;
      TEMP_COLOR.set(residualColor(residuals[i], maxAbs, palette.green, palette.yellow, palette.red));
      colors[i * 3] = TEMP_COLOR.r;
      colors[i * 3 + 1] = TEMP_COLOR.g;
      colors[i * 3 + 2] = TEMP_COLOR.b;
    }
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('color').needsUpdate = true;
    geometry.computeBoundingSphere();

    // 2. plano: contém a reta e se estende em profundidade (z)
    plane.position.set(0, line.b0, 0);
    PLANE_NORMAL.set(line.b1, -1, 0).normalize();
    plane.quaternion.setFromUnitVectors(PLANE_FRONT, PLANE_NORMAL);

    // 3. marcação do ponto escolhido (com o espinho até a reta)
    const active = selected >= 0 ? selected : hovered;
    if (active >= 0) {
      const predicted = line.b0 + line.b1 * cloud[active].x;
      marker.position.set(cloud[active].x, lastY[active], cloud[active].z);
      marker.scale.setScalar(1 + 0.12 * Math.sin(frame.t * 4));
      marker.visible = selected >= 0;
      spike.position.set(cloud[active].x, 0, cloud[active].z);
      SPIKE_FROM.set(0, predicted, 0);
      SPIKE_TO.set(0, lastY[active], 0);
      (spike.geometry as THREE.BufferGeometry).setFromPoints([SPIKE_FROM, SPIKE_TO]);
      spike.geometry.computeBoundingSphere();
      spike.visible = selected >= 0 && Math.abs(predicted - lastY[active]) > 0.01;
    } else {
      marker.visible = false;
      spike.visible = false;
    }

    formulas.forEach((f) => f.update(frame.t));
  };

  const readout = (): Readout[] => {
    const rows: Readout[] = [
      { label: 'Reta', value: `ŷ = ${line.b0.toFixed(2)} + ${line.b1.toFixed(2)}x` },
      { label: 'R²', value: line.r2.toFixed(3) },
      { label: 'Pontos', value: String(COUNT) },
    ];
    if (selected >= 0) {
      const predicted = line.b0 + line.b1 * cloud[selected].x;
      const residual = lastY[selected] - predicted;
      rows.push({
        label: `Resíduo do ponto #${selected + 1}`,
        value: `${residual > 0 ? '+' : ''}${residual.toFixed(2)} (${residual > 0.02 ? 'acima' : residual < -0.02 ? 'abaixo' : 'na'} da reta)`,
      });
    } else {
      rows.push({ label: 'Resíduo', value: 'clique num ponto' });
    }
    return rows;
  };

  return {
    id: 'dispersao',
    title: 'Dispersão 3D + regressão',
    tagline: 'Clique num ponto para acender o resíduo; arraste para girar',
    formula: 'ŷ = β_{0} + β_{1}x        R² = 1 − Σ(y_{i} − ŷ_{i})² / Σ(y_{i} − \\bar{y})²',
    explanation:
      'A reta é a de mínimos quadrados e o plano é ela "esticada" em profundidade. A cor de cada ponto mede o resíduo: verde está colado na reta, vermelho está longe. R² resume tudo num número — a fração da variação de y que a reta explica.',
    camera: [0, 2.6, 10.6],
    lookAtY: 2.4,
    drag: 'orbit',
    group,
    selectables: [dots],
    onPick(hit) {
      selected = typeof hit.index === 'number' && hit.index >= 0 && hit.index < COUNT ? hit.index : -1;
      if (selected < 0) return null;
      const predicted = line.b0 + line.b1 * cloud[selected].x;
      const residual = lastY[selected] - predicted;
      return `Ponto #${selected + 1}: y observado ${lastY[selected].toFixed(2)}, ŷ previsto ${predicted.toFixed(2)} → resíduo ${residual > 0 ? '+' : ''}${residual.toFixed(2)}`;
    },
    onHover(hit) {
      hovered = hit && typeof hit.index === 'number' ? hit.index : -1;
    },
    update,
    readout,
    reset() {
      selected = -1;
      hovered = -1;
    },
    dispose() {
      disposeObject(group);
    },
  };
}
