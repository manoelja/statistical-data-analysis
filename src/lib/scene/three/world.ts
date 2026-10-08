/**
 * O **mundo** 3D: reúne os seis elementos do quadro num corredor de exposições,
 * cuida da câmera (foco, paralaxe, enquadramento responsivo), das luzes, e
 * traduz ponteiro em intenção — clique, arrasto, hover.
 *
 * Nada aqui desenha: `world` monta o grafo de cena e o `viewer` renderiza. Essa
 * separação é o que permite testar a cena inteira em jsdom, sem GPU.
 */

import * as THREE from 'three';
import type { ChalkPalette } from '../chalk';
import { getSceneParams, type SceneParams } from '../store';
import { createGradientTexture } from './chalkText';
import { createCubeExhibit } from './cube';
import { createDiceExhibit } from './dice';
import { createFrequencyExhibit } from './frequency';
import { createHistogramExhibit } from './histogram';
import { createScatterExhibit } from './scatter';
import { clamp, damp, lerp } from './math';
import { chalkSegments, disposeObject } from './shared';
import { createVennExhibit } from './venn';
import type { BuildContext, Exhibit, Frame, Readout } from './types';

/** distância entre exposições no corredor */
export const SPACING = 16;

export interface WorldInfo {
  id: string;
  title: string;
  tagline: string;
}

export interface WorldDescription {
  index: number;
  title: string;
  tagline: string;
  formula: string;
  explanation: string;
  /** linha de detalhe do último clique (clique em face/ponto/célula) */
  detail: string | null;
  readout: Readout[];
}

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  info: WorldInfo[];
  current(): number;
  playing(): boolean;
  advance(dt: number, pointer: { x: number; y: number }): void;
  setPlaying(playing: boolean): void;
  focus(index: number): number;
  step(direction: number): number;
  describe(): WorldDescription;
  setAspect(aspect: number): void;
  pointerDown(x: number, y: number): void;
  pointerMove(x: number, y: number, dragging: boolean): void;
  pointerUp(x: number, y: number): string | null;
  hover(x: number, y: number): void;
  refreshText(): void;
  reset(): void;
  dispose(): void;
}

interface Slot {
  exhibit: Exhibit;
  pivot: THREE.Group;
  /** rotação de órbita aplicada por cima (arrasto no vazio) */
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
}

export function buildWorld(palette: ChalkPalette, params: SceneParams): World {
  const scene = new THREE.Scene();

  // ---- fundo: gradiente preto → azul-marinho da ardósia ----
  const background = createGradientTexture([
    [0, '#04060b'],
    [0.45, '#0b1426'],
    [1, '#05070d'],
  ]);
  scene.background = background;
  scene.fog = new THREE.Fog(new THREE.Color(palette.board1), 16, 44);

  const camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 220);
  camera.position.set(0, 2.6, 10.6);

  // ---- luzes (ambiente + direcional com sombra + dois holofotes coloridos) ----
  scene.add(new THREE.AmbientLight(palette.chalk, 0.5));

  const key = new THREE.DirectionalLight(palette.chalk, 1.5);
  key.position.set(6, 11, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  const rimCyan = new THREE.PointLight(palette.cyan, 60, 34, 2);
  const rimPink = new THREE.PointLight(palette.pink, 55, 34, 2);
  rimCyan.position.set(-4.5, 3.4, 5.5);
  rimPink.position.set(4.5, 4.2, 5);
  scene.add(rimCyan, rimPink);

  // ---- chão de giz (grade que acompanha o foco) + sombra suave ----
  const gridSegments: Array<[[number, number, number], [number, number, number]]> = [];
  const GRID = 44;
  for (let i = -GRID; i <= GRID; i += 2) {
    gridSegments.push([
      [i, 0, -GRID],
      [i, 0, GRID],
    ]);
    gridSegments.push([
      [-GRID, 0, i],
      [GRID, 0, i],
    ]);
  }
  const grid = chalkSegments(gridSegments, palette.chalk, 0.07);
  grid.position.y = -0.002;
  scene.add(grid);

  const shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.ShadowMaterial({ opacity: 0.42 }),
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = 0.001;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  // ---- poeira de giz (pontos subindo devagar) ----
  const DUST = 140;
  const dustPositions = new Float32Array(DUST * 3);
  const dustSpeeds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i += 1) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 46;
    dustPositions[i * 3 + 1] = Math.random() * 12;
    dustPositions[i * 3 + 2] = -8 + Math.random() * 22;
    dustSpeeds[i] = 0.12 + Math.random() * 0.35;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: palette.chalk,
      size: 0.07,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  scene.add(dust);

  // ---- exposições ----
  const ctx: BuildContext = { palette, plates: [], params };
  const exhibits: Exhibit[] = [
    createCubeExhibit(ctx),
    createHistogramExhibit(ctx),
    createScatterExhibit(ctx),
    createVennExhibit(ctx),
    createFrequencyExhibit(ctx),
    createDiceExhibit(ctx),
  ];

  const slots: Slot[] = exhibits.map((exhibit, index) => {
    const pivot = new THREE.Group();
    pivot.position.x = index * SPACING;
    pivot.add(exhibit.group);
    scene.add(pivot);
    return { exhibit, pivot, yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };
  });

  // ---- estado do controlador ----
  let index = 0;
  let playing = true;
  let aspect = 1.6;
  let time = 0;
  let detail: string | null = null;
  let hovered: THREE.Intersection | null = null;
  const raycaster = new THREE.Raycaster();
  // pontos da nuvem de dispersão são pequenos: alarga a tolerância do raio
  raycaster.params.Points = { threshold: 0.3 };

  const ndc = new THREE.Vector2();
  const pointerCamera = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const downAt = { x: 0, y: 0 };

  /** enquadramento: telas estreitas pedem câmera mais longe */
  const frameScale = () => clamp(1.5 / Math.max(aspect, 0.35), 1, 2);

  const currentSlot = () => slots[index];

  const pickTargets = (): THREE.Object3D[] => currentSlot().exhibit.selectables;

  const castAt = (x: number, y: number): THREE.Intersection | null => {
    ndc.set(x, y);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickTargets(), false);
    return hits[0] ?? null;
  };

  const frame = (): Frame => ({
    t: time,
    dt: 0,
    playing,
    pointer: { x: 0, y: 0 },
    params: getSceneParams(),
    focus: 1,
  });

  const advance = (dt: number, pointer: { x: number; y: number }) => {
    if (playing) time += dt;
    const slot = currentSlot();
    const params = getSceneParams();

    const step: Frame = {
      t: time,
      dt,
      playing,
      pointer,
      params,
      focus: 1,
    };
    // cada exposição anima sempre (é barato), mas só a em foco recebe foco = 1
    for (let i = 0; i < exhibits.length; i += 1) {
      step.focus = i === index ? 1 : 0;
      exhibits[i].update(step);
    }

    // órbita do arrasto (suavizada) sobre o pivô da exposição em foco
    slot.yaw = damp(slot.yaw, slot.targetYaw, 6, dt);
    slot.pitch = damp(slot.pitch, slot.targetPitch, 6, dt);
    slot.pivot.rotation.y = slot.yaw + pointer.x * 0.12;
    slot.pivot.rotation.x = clamp(slot.pitch - pointer.y * 0.06, -0.9, 0.9);

    // câmera: posição do quadro + paralaxe, com perseguição suave
    const [cx, cy, cz] = slot.exhibit.camera;
    desired.set(slot.pivot.position.x + cx, cy, cz * frameScale());
    pointerCamera.set(pointer.x * 1.1, -pointer.y * 0.8, 0);
    camera.position.x = lerp(camera.position.x, desired.x + pointerCamera.x, 1 - Math.exp(-3.2 * dt));
    camera.position.y = lerp(camera.position.y, desired.y + pointerCamera.y, 1 - Math.exp(-3.2 * dt));
    camera.position.z = lerp(camera.position.z, desired.z, 1 - Math.exp(-2.6 * dt));

    lookTarget.set(
      slot.pivot.position.x + pointer.x * 0.5,
      slot.exhibit.lookAtY - pointer.y * 0.35,
      0,
    );
    camera.lookAt(lookTarget);

    // luzes e chão seguem o foco (a sombra só precisa existir onde se olha)
    key.position.set(slot.pivot.position.x + 6, 11, 8);
    key.target.position.set(slot.pivot.position.x, 0, 0);
    key.target.updateMatrixWorld();
    rimCyan.position.x = slot.pivot.position.x - 4.5;
    rimPink.position.x = slot.pivot.position.x + 4.5;
    grid.position.x = Math.round(slot.pivot.position.x / SPACING) * SPACING;
    dust.position.x = grid.position.x;
    shadowFloor.position.x = slot.pivot.position.x;

    // poeira: sobe devagar e volta para o chão ao sair de cena
    const dustAttribute = dustGeometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < DUST; i += 1) {
      if (!playing) break;
      let y = dustAttribute.getY(i) + dustSpeeds[i] * dt;
      if (y > 12) y = 0;
      dustAttribute.setY(i, y);
    }
    if (playing) dustAttribute.needsUpdate = true;

    // matrizes em dia para o raio da interação (o renderizador faria isso, mas
    // o clique pode chegar entre dois quadros — e nos testes não há renderizador)
    scene.updateMatrixWorld();
  };

  const describe = (): WorldDescription => {
    const exhibit = currentSlot().exhibit;
    const info = exhibit.focusInfo?.() ?? null;
    return {
      index,
      title: info?.title ?? exhibit.title,
      tagline: exhibit.tagline,
      formula: info?.formula ?? exhibit.formula,
      explanation: info?.explanation ?? exhibit.explanation,
      detail,
      readout: exhibit.readout(),
    };
  };

  const focus = (next: number) => {
    index = clamp(Math.round(next), 0, slots.length - 1);
    detail = null;
    hovered = null;
    return index;
  };

  const step = (direction: number) => focus((index + direction + slots.length) % slots.length);

  const reset = () => {
    slots.forEach((slot) => {
      slot.yaw = 0;
      slot.pitch = 0;
      slot.targetYaw = 0;
      slot.targetPitch = 0;
      slot.exhibit.reset();
    });
    index = 0;
    time = 0;
    detail = null;
    playing = true;
  };

  return {
    scene,
    camera,
    info: exhibits.map((exhibit) => ({ id: exhibit.id, title: exhibit.title, tagline: exhibit.tagline })),
    current: () => index,
    playing: () => playing,
    advance,
    setPlaying(value: boolean) {
      playing = value;
    },
    focus,
    step,
    describe,
    reset,
    setAspect: (value: number) => {
      aspect = clamp(value, 0.2, 6);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    pointerDown(x: number, y: number) {
      downAt.x = x;
      downAt.y = y;
    },
    pointerMove(x: number, y: number, isDragging: boolean) {
      if (!isDragging) return;
      const dx = x - downAt.x;
      const dy = y - downAt.y;
      downAt.x = x;
      downAt.y = y;
      const slot = currentSlot();
      if (slot.exhibit.drag === 'orbit') {
        // arrasto girando a peça (o movimento é acumulado e amaciado no laço)
        slot.targetYaw += dx * 3;
        slot.targetPitch = clamp(slot.targetPitch - dy * 1.8, -0.85, 0.85);
        slot.yaw = slot.targetYaw;
        slot.pitch = slot.targetPitch;
      } else {
        // arrasto mexendo no parâmetro (μ/σ no histograma, distância no Venn)
        slot.exhibit.onDrag?.(dx, dy);
      }
    },
    pointerUp(x: number, y: number) {
      const moved = Math.hypot(x - downAt.x, y - downAt.y);
      // clique curto = seleção; arrasto = órbita/parâmetro (não seleciona)
      if (moved < 0.02) {
        const hit = castAt(x, y);
        if (hit) {
          detail = currentSlot().exhibit.onPick?.(hit, frame()) ?? null;
        } else {
          detail = null;
        }
      }
      return detail;
    },
    hover(x: number, y: number) {
      const hit = castAt(x, y);
      const previous = hovered;
      if (previous?.object !== hit?.object || previous?.index !== hit?.index) {
        hovered = hit;
        currentSlot().exhibit.onHover?.(hit);
      }
    },
    refreshText() {
      ctx.plates.forEach((plate) => plate.refresh());
    },
    dispose() {
      exhibits.forEach((exhibit) => exhibit.dispose());
      ctx.plates.forEach((plate) => plate.dispose());
      disposeObject(scene);
      background.dispose();
      dustGeometry.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
    },
  };
}
