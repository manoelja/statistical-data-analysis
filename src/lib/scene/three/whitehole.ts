/**
 * O **buraco branco** — o epílogo da jornada.
 *
 * Um buraco branco é o buraco negro com o tempo invertido: mesmo disco de
 * partículas, mesmo cisalhamento de Kepler, mas girando ao contrário — o disco
 * **fecha** em direção a um núcleo e é **ejetado** para fora. É por isso que o
 * shader daqui é o do buraco negro (`blackhole.ts`) com os sinais trocados, e
 * não uma peça nova: o fim da página é a mesma conta ao contrário.
 *
 * Não tem sombra nem anel de fótons (quem engole tem; quem emite, não) e a poeira
 * que o alimenta é a **do próprio corredor** — a mesma nuvem de
 * `journey.ts` que o buraco negro soprou no começo da viagem. A moldura do
 * capítulo é a mesma: tudo é dirigido por `journey.emitPhase`, função pura do
 * scroll, para o `reduced-motion` ter exatamente o mesmo caminho.
 *
 * Três peças, na ordem em que aparecem:
 * - o **disco** que converge (o mesmo `Points` com shader próprio);
 * - o **núcleo**, um ponto de luz que cresce conforme a nuvem fecha;
 * - a **casca**, o anel de choque que sai quando o núcleo estoura — mais o
 *   **véu branco**, preso à câmera, que toma o quadro no fim.
 */

import * as THREE from 'three';
import { DISK_TILT } from './blackhole';
import { createDotTexture } from './chalkText';
import { clamp } from './math';
import { disposeObject } from './shared';
import type { BuildContext, Frame } from './types';

/** Raio do núcleo aceso: onde a poeira do corredor colapsa. */
export const CORE_RADIUS = 7;

/** Disco de emissão: nasce nas bordas do corredor e fecha no núcleo. */
export const SHELL_INNER = 13;
export const SHELL_OUTER = 46;

/**
 * Onde a câmera estaciona para ver o buraco branco (unidades de cena).
 *
 * São **100**. A conta é de composição, não de alcance: no FOV de 67° do
 * epílogo, o quadro a essa distância tem ~235 × 132 unidades — o anel aceso da
 * nebulosa (que ocupa ~38% de uma foto de 190) fica em ~72 unidades, ou **55%
 * da altura**. Mais perto a nebulosa estourava a tela e comia o céu do card de
 * contato; mais longe virava figura pequena no fundo do corredor.
 */
export const WHITE_HOLE_STOP = 100;

const DISK_COUNT = 2600;
/** Quanto o disco é ejetado para fora no estouro (multiplicador de raio). */
const BURST_SPREAD = 7;

export interface WhiteHole {
  group: THREE.Group;
  /** o véu branco preso à câmera (entra em `camera.children`) */
  flash: THREE.Mesh;
  update(frame: Frame, phase: EmitPhase, camera: THREE.PerspectiveCamera): void;
  dispose(): void;
}

/** Fase do epílogo, calculada (e testada) em `journey.emitPhase`. */
export interface EmitPhase {
  /** 0 → 1 enquanto a poeira converge */
  gather: number;
  /** 0 → 1 no estouro (o branco toma o quadro) */
  burst: number;
  /** 0 → 1 quando o branco baixa e a nebulosa nasce no lugar do buraco */
  afterglow: number;
  /** peso do olhar: 1 = mirando o buraco branco, 0 = olhando o corredor */
  aim: number;
}

/** Amostra um raio no disco, com mais densidade perto do núcleo. */
function sampleRadius(random: () => number): number {
  const t = Math.pow(random(), 1.3);
  return SHELL_INNER + t * (SHELL_OUTER - SHELL_INNER);
}

/**
 * O disco de emissão. Mesma estrutura do disco de acreção (atributos por
 * partícula, tudo calculado no vertex shader), com o tempo invertido.
 */
function createEmissionDisk(ctx: BuildContext): {
  points: THREE.Points;
  uniforms: Record<string, THREE.IUniform>;
} {
  const { palette } = ctx;
  const positions = new Float32Array(DISK_COUNT * 3);
  const radius = new Float32Array(DISK_COUNT);
  const angle = new Float32Array(DISK_COUNT);
  const thickness = new Float32Array(DISK_COUNT);
  const bright = new Float32Array(DISK_COUNT);

  let seed = 987654321;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < DISK_COUNT; i += 1) {
    const r = sampleRadius(random);
    radius[i] = r;
    angle[i] = random() * Math.PI * 2;
    thickness[i] = (random() - 0.5) * (1.4 + r * 0.04);
    bright[i] = 0.35 + random() * 0.65;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  geometry.setAttribute('aThick', new THREE.BufferAttribute(thickness, 1));
  geometry.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SHELL_OUTER * 2.5);

  // branco no centro (o que sai), ciano no meio, âmbar na borda (o que entrou)
  const core = new THREE.Color('#fffdf4');
  const mid = new THREE.Color(palette.cyan);
  const edge = new THREE.Color(palette.yellow);

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uGather: { value: 0 },
    uBurst: { value: 0 },
    uAfterglow: { value: 0 },
    uOpacity: { value: 1 },
    uInner: { value: SHELL_INNER },
    uOuter: { value: SHELL_OUTER },
    uCore: { value: core },
    uMid: { value: mid },
    uEdge: { value: edge },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aRadius;
      attribute float aAngle;
      attribute float aThick;
      attribute float aBright;

      uniform float uTime;
      uniform float uGather;
      uniform float uBurst;
      uniform float uAfterglow;
      uniform float uOpacity;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uCore;
      uniform vec3 uMid;
      uniform vec3 uEdge;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float r = aRadius;
        // o mesmo cisalhamento de Kepler do disco de acreção — girando ao
        // contrário: aqui a nuvem sai, não entra
        float omega = pow(max(r, 0.001), -1.5) * -26.0;
        float theta = aAngle + uTime * omega;

        // gather: a nuvem fecha em direção ao núcleo
        float rr = mix(r, r * 0.16, uGather);
        // burst: ela é ejetada para fora e afina (a nuvem vira casca)
        rr *= 1.0 + uBurst * ${BURST_SPREAD.toFixed(1)};
        float thick = aThick * (1.0 + uGather * 5.0) * (1.0 - uBurst * 0.85);

        vec3 pos = vec3(
          rr * cos(theta),
          rr * sin(theta),
          thick
        );

        // doppler invertido: o lado que "falava" para o buraco negro brilha aqui
        float side = 0.5 + 0.5 * sin(theta * 0.6 + 0.7);
        float beaming = 0.35 + 1.65 * side;

        float u = clamp((r - uInner) / max(uOuter - uInner, 0.001), 0.0, 1.0);
        vec3 col = mix(uCore, uMid, smoothstep(0.0, 0.55, u));
        col = mix(col, uEdge, smoothstep(0.5, 1.0, u));
        col *= beaming * aBright;

        // enquanto converge, a nuvem acende (a energia se concentra); ao estourar
        // ela se dissolve por completo (é o branco do véu que toma o quadro) — e
        // o afterglow garante que nada fique pendurado: a nebulosa nasce **no
        // mesmo lugar**, e um resto do buraco ali seria errado
        float lit = clamp(uGather * 1.5, 0.0, 1.0) * (1.0 - uBurst) * (1.0 - uAfterglow);
        vColor = col * (0.4 + 0.6 * lit);
        vAlpha = uOpacity * lit * (0.5 + 0.5 * side);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aBright * 240.0 / max(-mv.z, 0.001), 0.5, 9.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.02, d);
        a *= a;
        if (a * vAlpha < 0.004) discard;
        gl_FragColor = vec4(vColor, a * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, uniforms };
}

/**
 * O núcleo: um ponto de luz que cresce enquanto a nuvem fecha. É `dotTexture`
 * (o mesmo ponto suave da poeira) numa cor branca, com mistura aditiva.
 */
function createCore(): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: createDotTexture('#fffdf4'),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 998;
  return sprite;
}

/**
 * A casca: o anel de choque da ejeção. Fica **coplanar com o disco** (mesma
 * inclinação), senão lê como um aro torto atrás do núcleo.
 */
function createShell(): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#fffdf4'),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), material);
  mesh.rotation.x = DISK_TILT;
  // a câmera atravessa a casca de propósito (é a frente da onda de choque)
  mesh.userData.letCameraPass = true;
  return mesh;
}

/**
 * O véu de estouro. Fica preso à câmera (entra em `camera.children`) e cobre o
 * quadro inteiro: o mesmo truque do clarão do prólogo, com o branco do outro
 * lado.
 */
function createFlash(): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#fffdf4'),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.position.set(0, 0, -1.2);
  mesh.renderOrder = 999;
  mesh.frustumCulled = false;
  return mesh;
}

export function createWhiteHole(ctx: BuildContext): WhiteHole {
  const group = new THREE.Group();
  // a câmera cruza este grupo de propósito (o teste que varre a viagem ignora
  // o que estiver marcado assim)
  group.userData.letCameraPass = true;

  const { points: disk, uniforms } = createEmissionDisk(ctx);
  disk.rotation.x = DISK_TILT;
  group.add(disk);

  const core = createCore();
  group.add(core);

  const shell = createShell();
  group.add(shell);

  const flash = createFlash();

  const update = (frame: Frame, phase: EmitPhase, camera: THREE.PerspectiveCamera) => {
    const { gather, burst, afterglow } = phase;
    uniforms.uTime.value = frame.t;
    uniforms.uGather.value = gather;
    uniforms.uBurst.value = burst;
    uniforms.uAfterglow.value = afterglow;

    // o núcleo acende com a convergência e é engolido pelo branco do estouro
    const lit = clamp(gather * 1.4, 0, 1) * (1 - burst) * (1 - afterglow);
    const coreMaterial = core.material as THREE.SpriteMaterial;
    coreMaterial.opacity = lit * 0.95;
    const coreSize = CORE_RADIUS * 2 * (0.35 + 0.65 * gather);
    core.scale.set(coreSize, coreSize, 1);

    // a casca sai do núcleo quando estoura: cresce e some nas bordas do quadro
    const shellSpread = burst * burst * BURST_SPREAD;
    const shellSize = CORE_RADIUS * 2 + shellSpread * SHELL_OUTER;
    shell.scale.set(shellSize, shellSize, 1);
    (shell.material as THREE.MeshBasicMaterial).opacity =
      Math.sin(Math.PI * clamp(burst, 0, 1)) * 0.8 * (1 - afterglow);

    // o véu cobre o frustum inteiro, qualquer que seja o fov do quadro
    const dist = Math.abs(flash.position.z);
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
    const width = height * camera.aspect;
    flash.scale.set(width * 1.2, height * 1.2, 1);
    // e **desce** no afterglow: senão o branco ficaria na tela para sempre
    (flash.material as THREE.MeshBasicMaterial).opacity =
      clamp(burst * 1.1, 0, 1) * 0.94 * (1 - afterglow);
  };

  return {
    group,
    flash,
    update,
    dispose() {
      disposeObject(group);
      const flashMaterial = flash.material as THREE.Material;
      flashMaterial.dispose();
      flash.geometry.dispose();
    },
  };
}
