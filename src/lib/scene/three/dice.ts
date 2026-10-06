/**
 * 6. **Dados 3D**.
 *
 * Dois cubos com as faces pintadas de verdade (cada face tem sua textura de
 * pintas). Rolam ao clique — giram no ar e pousam mostrando uma face — e a
 * distribuição da soma fica desenhada atrás: 11 colunas cujas alturas são as
 * 36 combinações. A coluna da soma sorteada acende, então o "6/36 ≈ 16,7%"
 * deixa de ser número solto e passa a ser a altura da coluna.
 */

import * as THREE from 'three';
import { clamp, diceSumCounts, diceSumProbability } from './math';
import { createDieFaceTexture } from './chalkText';
import { createFloatingFormula, type FloatingFormula } from './formulas';
import { chalkEdges, createHalo, disposeObject } from './shared';
import type { BuildContext, Exhibit, Frame, Readout } from './types';

const SIZE = 1.5;
const FLOOR_Y = SIZE / 2;
const ROLL_TIME = 1.05;

/** ordem das faces do BoxGeometry: +x, −x, +y, −y, +z, −z */
const FACE_VALUES = [5, 2, 3, 4, 1, 6];

/** Rotação que traz a face de valor `value` para a frente da câmera. */
function quaternionForFace(value: number, target: THREE.Quaternion): THREE.Quaternion {
  const euler = new THREE.Euler(0, 0, 0);
  switch (value) {
    case 5:
      euler.y = -Math.PI / 2;
      break;
    case 2:
      euler.y = Math.PI / 2;
      break;
    case 3:
      euler.x = Math.PI / 2;
      break;
    case 4:
      euler.x = -Math.PI / 2;
      break;
    case 6:
      euler.y = Math.PI;
      break;
    default:
      break;
  }
  return target.setFromEuler(euler);
}

interface Die {
  mesh: THREE.Mesh;
  baseX: number;
  hovered: boolean;
  rolling: boolean;
  rollStart: number;
  face: number;
  targetQuaternion: THREE.Quaternion;
  nextRoll: number;
}

export function createDiceExhibit(ctx: BuildContext): Exhibit {
  const { palette } = ctx;
  const group = new THREE.Group();

  const geometry = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
  const counts = diceSumCounts(2, 6);
  const maxCount = Math.max(...counts);

  const makeDie = (x: number, color: string): Die => {
    const materials = FACE_VALUES.map(
      (value) =>
        new THREE.MeshStandardMaterial({
          map: createDieFaceTexture(value, color, 256),
          transparent: true,
          roughness: 0.55,
          metalness: 0.08,
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.12,
        }),
    );
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.position.set(x, FLOOR_Y + 0.05, 0);
    const halo = createHalo(color, SIZE * 0.95, 0.22);
    halo.position.set(x, 0.02, 0);
    // o contorno acompanha o dado (eles compartilham a mesma geometria)
    const edges = chalkEdges(geometry, color);
    edges.position.copy(mesh.position);
    group.add(mesh, halo, edges);
    mesh.userData.edges = edges;
    return {
      mesh,
      baseX: x,
      hovered: false,
      rolling: false,
      rollStart: -9,
      face: 1 + Math.floor(Math.random() * 6),
      targetQuaternion: quaternionForFace(1, new THREE.Quaternion()),
      nextRoll: 2 + Math.random() * 4,
    };
  };

  const dice: Die[] = [makeDie(-1.25, palette.cyan), makeDie(1.25, palette.pink)];
  dice.forEach((die) => {
    quaternionForFace(die.face, die.targetQuaternion);
    die.mesh.quaternion.copy(die.targetQuaternion);
  });

  // ---- distribuição da soma (11 colunas = 36 combinações) ----
  const distribution = new THREE.Group();
  const bars: THREE.Mesh[] = [];
  const barGeometry = new THREE.BoxGeometry(0.42, 1, 0.42);
  for (let sum = 2; sum <= 12; sum += 1) {
    const bar = new THREE.Mesh(
      barGeometry,
      new THREE.MeshStandardMaterial({
        color: palette.blue,
        roughness: 0.6,
        transparent: true,
        opacity: 0.5,
        emissive: new THREE.Color(palette.blue),
        emissiveIntensity: 0.1,
      }),
    );
    const height = (counts[sum] / maxCount) * 1.9;
    bar.scale.y = height;
    bar.position.set((sum - 7) * 0.62, height / 2, -3.1);
    distribution.add(bar);
    bars[sum] = bar;
  }
  group.add(distribution);

  const formulas: FloatingFormula[] = [
    createFloatingFormula(ctx, {
      text: 'P(X = x) = C(n,x)·p^{x}(1−p)^{n−x}',
      color: palette.green,
      position: [-3.2, 3.1, 0],
      height: 0.44,
      seed: 4,
    }),
    createFloatingFormula(ctx, {
      text: 'E(X) = Σ x_{i}p_{i}',
      color: palette.chalk,
      position: [3.2, 3.1, 0],
      height: 0.46,
      seed: 14,
    }),
    createFloatingFormula(ctx, {
      text: 'Var(X) = E(X²) − [E(X)]²',
      color: palette.orange,
      position: [-2.6, -1.5, 0.4],
      height: 0.4,
      seed: 24,
    }),
  ];
  formulas.forEach((f) => group.add(f.sprite));

  // ---- estado ----
  let lastSum = dice[0].face + dice[1].face;

  const roll = (die: Die, t: number, offset = 0) => {
    die.rolling = true;
    die.rollStart = t + offset;
    die.face = 1 + Math.floor(Math.random() * 6);
    quaternionForFace(die.face, die.targetQuaternion);
  };

  const update = (frame: Frame) => {
    dice.forEach((die, index) => {
      const since = frame.t - die.rollStart;
      const rolling = die.rolling && since >= 0 && since <= ROLL_TIME;

      if (die.rolling && since > ROLL_TIME) die.rolling = false;

      if (rolling) {
        // giro no ar + pulinho, com as faces trocando de valor no caminho
        const k = since / ROLL_TIME;
        die.mesh.rotation.x += frame.dt * 24 * (index ? -1 : 1);
        die.mesh.rotation.y += frame.dt * 19 * (index ? 1 : -1);
        die.mesh.rotation.z += frame.dt * 7;
        die.mesh.position.y = FLOOR_Y + 0.05 + 1.5 * Math.sin(Math.PI * k);
        if (Math.floor(k * 12) !== die.mesh.userData.tick) {
          die.mesh.userData.tick = Math.floor(k * 12);
          die.face = 1 + Math.floor(Math.random() * 6);
          quaternionForFace(die.face, die.targetQuaternion);
        }
      } else {
        // pousa: interpola até a rotação da face sorteada
        die.mesh.quaternion.slerp(die.targetQuaternion, clamp(frame.dt * 7, 0, 1));
        die.mesh.position.y += (FLOOR_Y + 0.05 - die.mesh.position.y) * clamp(frame.dt * 8, 0, 1);
        die.mesh.position.x = die.baseX;
        if (frame.playing) {
          if (die.hovered) die.mesh.rotation.y += frame.dt * 2.4;
          if (frame.t > die.nextRoll) {
            die.nextRoll = frame.t + 5 + Math.random() * 4;
            roll(die, frame.t, index * 0.18);
          }
        }
      }
      const edges = die.mesh.userData.edges as THREE.Object3D | undefined;
      edges?.position.copy(die.mesh.position);
      edges?.quaternion.copy(die.mesh.quaternion);
    });

    const sum = dice[0].face + dice[1].face;
    if (sum !== lastSum) lastSum = sum;
    for (let s = 2; s <= 12; s += 1) {
      const bar = bars[s];
      if (!bar) continue;
      const on = s === lastSum;
      (bar.material as THREE.MeshStandardMaterial).emissiveIntensity = on
        ? 0.6 + 0.3 * Math.sin(frame.t * 4)
        : 0.1;
      (bar.material as THREE.MeshStandardMaterial).opacity = on ? 0.95 : 0.42;
      bar.scale.x = on ? 1.25 : 1;
      bar.scale.z = on ? 1.25 : 1;
    }

    formulas.forEach((f) => f.update(frame.t));
  };

  const readout = (): Readout[] => {
    const [a, b] = dice;
    const sum = a.face + b.face;
    return [
      { label: 'Dado 1', value: `${a.face}${a.rolling ? ' (rolando)' : ''}` },
      { label: 'Dado 2', value: `${b.face}${b.rolling ? ' (rolando)' : ''}` },
      { label: 'Soma', value: String(sum) },
      { label: `P(soma = ${sum})`, value: `${(diceSumProbability(sum) * 100).toFixed(1).replace('.', ',')}%` },
      { label: 'Soma mais provável', value: '7 — 6/36 ≈ 16,7%' },
    ];
  };

  return {
    id: 'dados',
    title: 'Dados 3D',
    tagline: 'Clique para rolar; passe o mouse para girar os dados',
    formula: 'P(X = x) = C(n,x)·p^{x}(1−p)^{n−x}',
    explanation:
      'Cada dado tem 6 faces equiprováveis, então há 36 resultados possíveis ao rolar dois. Somar é combinar: só existe uma forma de obter 2 (1+1) e seis formas de obter 7 (1+6, 2+5, …, 6+1) — por isso a distribuição da soma tem esse formato de telhado.',
    camera: [0, 2.4, 10.2],
    lookAtY: 0.9,
    drag: 'orbit',
    group,
    selectables: dice.map((die) => die.mesh),
    onPick(hit, frame) {
      const die = dice.find((d) => d.mesh === hit.object);
      if (!die) return null;
      roll(die, frame.t);
      return `Rolando o dado ${dice.indexOf(die) + 1}…`;
    },
    onHover(hit) {
      dice.forEach((die) => {
        die.hovered = hit?.object === die.mesh;
      });
    },
    update,
    readout,
    reset() {
      dice.forEach((die, index) => {
        die.rolling = false;
        die.rollStart = -9;
        die.face = 1 + index;
        quaternionForFace(die.face, die.targetQuaternion);
        die.mesh.quaternion.copy(die.targetQuaternion);
        die.mesh.position.set(die.baseX, FLOOR_Y + 0.05, 0);
        die.nextRoll = 3 + index * 1.5;
      });
      lastSum = dice[0].face + dice[1].face;
    },
    dispose() {
      disposeObject(group);
    },
  };
}
