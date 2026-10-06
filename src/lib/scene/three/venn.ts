/**
 * 4. **Diagrama de Venn 3D**.
 *
 * Duas esferas translúcidas (mistura aditiva: onde elas se cruzam, a cor *muda*
 * sozinha) mais uma lente explícita em rosa marcando A∩B. Passar o mouse por
 * uma esfera a infla; arrastar aproxima ou afasta os centros — e aí as
 * probabilidades seguem a **geometria**: P(A∩B) = P(A) × (fração da lente).
 */

import * as THREE from 'three';
import { clamp, damp, overlapRatio } from './math';
import { createChalkSprite } from './chalkText';
import { createFloatingFormula, type FloatingFormula } from './formulas';
import { disposeObject } from './shared';
import type { BuildContext, Exhibit, Frame, Readout } from './types';

const RADIUS = 1.9;
/** probabilidades "reais" dos eventos (o tamanho da esfera é decorativo) */
const P_A = 0.5;
const P_B = 0.45;
const DISTANCE_RANGE: [number, number] = [0, 2 * RADIUS];

export function createVennExhibit(ctx: BuildContext): Exhibit {
  const { palette } = ctx;
  const group = new THREE.Group();

  const sphereGeometry = new THREE.SphereGeometry(RADIUS, 40, 28);

  /** material translúcido aditivo: o cruzamento soma as cores */
  const shell = (color: string, opacity: number) =>
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.35,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.4,
    });

  const sphereA = new THREE.Mesh(sphereGeometry, shell(palette.cyan, 0.22));
  const sphereB = new THREE.Mesh(sphereGeometry, shell(palette.yellow, 0.2));
  group.add(sphereA, sphereB);

  // contornos (o "traço de giz" que fecha cada conjunto)
  const outline = (color: string) => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i += 1) {
      const angle = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * RADIUS, Math.sin(angle) * RADIUS, 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }),
    );
  };
  const ringA = outline(palette.cyan);
  const ringB = outline(palette.yellow);
  group.add(ringA, ringB);

  // lente: aproxima a interseção dos dois volumes
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshBasicMaterial({
      color: palette.pink,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(lens);

  // rótulos
  const label = (text: string, color: string) => {
    const { sprite, plate } = createChalkSprite([{ text, size: 60, color }], { worldHeight: 0.62 });
    ctx.plates.push(plate);
    group.add(sprite);
    return sprite;
  };
  const labelA = label('A', palette.cyan);
  const labelB = label('B', palette.yellow);
  const labelInter = label('A ∩ B', palette.pink);

  const formulas: FloatingFormula[] = [
    createFloatingFormula(ctx, {
      text: 'P(A∪B) = P(A) + P(B) − P(A∩B)',
      color: palette.chalk,
      position: [-2.6, 3.6, 0],
      height: 0.44,
      seed: 7,
    }),
    createFloatingFormula(ctx, {
      text: 'P(A∩B) = P(A)·P(B|A)',
      color: palette.pink,
      position: [1.4, -2.9, 0.4],
      height: 0.42,
      seed: 19,
    }),
  ];
  formulas.forEach((f) => group.add(f.sprite));

  // ---- estado ----
  let distance = 1.1;
  let targetDistance = 1.1;
  let dragged = false;
  let hovered: 'A' | 'B' | null = null;
  let overlap = overlapRatio(distance, RADIUS);

  const update = (frame: Frame) => {
    if (!dragged && frame.playing) {
      // vaivém quando ninguém está mexendo (o mesmo espírito do quadro)
      targetDistance = RADIUS * (0.62 + 0.55 * Math.sin(frame.t * 0.35));
    }
    dragged = false;
    distance = damp(distance, clamp(targetDistance, DISTANCE_RANGE[0], DISTANCE_RANGE[1]), 3, frame.dt);

    const half = distance / 2;
    sphereA.position.x = -half;
    sphereB.position.x = half;
    ringA.position.x = -half;
    ringB.position.x = half;

    // lente: elipsoide que encolhe até sumir quando os centros se afastam
    const lensHalfHeight = Math.sqrt(Math.max(0.0001, RADIUS * RADIUS - half * half));
    const lensHalfWidth = Math.max(0.001, RADIUS - half);
    lens.position.set(0, 0, 0);
    lens.scale.set(lensHalfWidth, lensHalfHeight, lensHalfHeight);
    overlap = overlapRatio(distance, RADIUS);
    lens.material.opacity = 0.06 + 0.34 * overlap;

    // inflar no hover
    const scaleA = 1 + (hovered === 'A' ? 0.09 : 0);
    const scaleB = 1 + (hovered === 'B' ? 0.09 : 0);
    sphereA.scale.setScalar(damp(sphereA.scale.x, scaleA, 8, frame.dt));
    sphereB.scale.setScalar(damp(sphereB.scale.x, scaleB, 8, frame.dt));
    (sphereA.material as THREE.MeshStandardMaterial).opacity =
      0.22 + (hovered === 'A' ? 0.16 : 0) + 0.06 * Math.sin(frame.t * 1.3);
    (sphereB.material as THREE.MeshStandardMaterial).opacity =
      0.2 + (hovered === 'B' ? 0.16 : 0) + 0.06 * Math.sin(frame.t * 1.3 + 1);

    labelA.position.set(-half - RADIUS * 0.72, 0.85, 0.2);
    labelB.position.set(half + RADIUS * 0.72, 0.85, 0.2);
    labelInter.position.set(0, -0.2, 0.4);
    labelInter.material.opacity = clamp(overlap * 2.2 - 0.12, 0, 0.95);

    formulas.forEach((f) => f.update(frame.t));
  };

  const readout = (): Readout[] => {
    const pInter = Math.min(P_A, P_B) * overlap;
    const pUnion = P_A + P_B - pInter;
    return [
      { label: 'P(A)', value: `${P_A.toFixed(2)}${hovered === 'A' ? '  ◀' : ''}` },
      { label: 'P(B)', value: `${P_B.toFixed(2)}${hovered === 'B' ? '  ◀' : ''}` },
      { label: 'P(A∩B)', value: pInter.toFixed(3) },
      { label: 'P(A∪B)', value: pUnion.toFixed(3) },
      { label: 'Sobreposição', value: `${Math.round(overlap * 100)}%` },
    ];
  };

  return {
    id: 'venn',
    title: 'Venn 3D',
    tagline: 'Arraste para afastar as esferas; passe o mouse para inflar',
    formula: 'P(A∪B) = P(A) + P(B) − P(A∩B)',
    explanation:
      'Duas esferas, dois eventos. Onde elas se cruzam aparece outra cor: é a interseção. A probabilidade da união desconta o que foi contado duas vezes — por isso subtraímos P(A∩B). Arraste para ver que, quanto mais os eventos se sobrepõem, maior é P(A∩B) e menor é o "desconto".',
    camera: [0, 1.6, 9.4],
    lookAtY: 0,
    drag: 'params',
    group,
    selectables: [sphereA, sphereB],
    onDrag(dx) {
      targetDistance = clamp(targetDistance + dx * 2.2, DISTANCE_RANGE[0], DISTANCE_RANGE[1]);
      dragged = true;
    },
    onPick(hit) {
      const which = hit.object === sphereA ? 'A' : hit.object === sphereB ? 'B' : null;
      if (!which) return null;
      hovered = which;
      const pInter = Math.min(P_A, P_B) * overlap;
      return `Evento ${which}: P(${which}) = ${(which === 'A' ? P_A : P_B).toFixed(2)} · P(A∩B) = ${pInter.toFixed(3)} · P(A∪B) = ${(P_A + P_B - pInter).toFixed(3)}`;
    },
    onHover(hit) {
      hovered = hit ? (hit.object === sphereA ? 'A' : hit.object === sphereB ? 'B' : null) : null;
    },
    update,
    readout,
    reset() {
      targetDistance = 1.1;
      distance = 1.1;
      hovered = null;
    },
    dispose() {
      disposeObject(group);
    },
  };
}
