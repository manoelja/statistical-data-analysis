/**
 * A **nebulosa** — a peça de chegada, no fundo do corredor.
 *
 * Aqui a nebulosa **não é desenhada**: a foto da Nebulosa do Hélice (o "Olho de
 * Deus") é importada de `src/assets/` e usada como textura de um sprite. É uma
 * troca deliberada: a foto tem a fractalidade real do gás — milhares de
 * filamentos que nenhum shader procedural reproduz com fidelidade — e o código
 * cuida só do que a foto não tem.
 *
 * O fundo da foto é preto, e é por isso que ela **não precisa de transparência**:
 * com `AdditiveBlending`, o preto simplesmente não acrescenta nada. O mesmo
 * additive que faz o brilho do gás se dissolver no fundo do corredor é o truque
 * que descarta o céu da foto — sem recorte alpha, sem halo nas bordas. (Se um
 * dia entrar um PNG/WebP com alpha, o caminho é o mesmo.)
 *
 * Camadas, de trás para a frente:
 *
 * 1. **a foto** — a estrutura real: a íris de filamentos laranja-dourados, o
 *    miolo escuro e a névoa vermelha que se dissolve nas bordas;
 * 2. **o brilho** — um shader de halo que respira, para a foto não parecer um
 *    recorte colado no fundo (o sprite sozinho ficaria com cara de "figura");
 * 3. **a poeira** — partículas radiais saindo do centro, que é o que dá
 *    movimento: a foto é estática, o gás não;
 * 4. **o miolo e a anã** — o azul profundo da pupila e o ponto branco no centro
 *    exato, os dois únicos pontos que a foto não tem com brilho próprio;
 * 5. **as estrelas** — campo aditivo com tamanhos e brilhos variados e as quatro
 *    pontas de difração nas maiores, que existem para dar paralaxe e cintilar
 *    (a foto não tem nenhuma das duas coisas).
 *
 * Nenhum asset além da foto: os pontos de brilho e poeira são canvas (a mesma
 * `createDotTexture` da poeira do corredor).
 */

import * as THREE from 'three';
import { createDotTexture } from './chalkText';
import { clamp } from './math';
import { createAdditivePhoto, disposeObject } from './shared';
import nebulosaUrl from '../../../assets/nebulosa.jpg';
import type { BuildContext } from './types';

/**
 * A foto.
 *
 * **Importada**, e não digitada como caminho: é o que faz a build exigir a
 * imagem. Em `public/` ela seria copiada às cegas e um 404 só apareceria em
 * produção, onde a nebulosa perderia a foto **em silêncio** — o `TextureLoader`
 * não tem callback de erro, e o resto da peça (brilho, poeira, pupila, anã,
 * estrelas) continua desenhando, então a falha pareceria uma escolha de design.
 * Como import, o arquivo ausente quebra a compilação.
 *
 * E de brinde o nome sai com hash (`nebulosa-<hash>.jpg`), que é cache busting
 * de graça. Para trocar por um PNG/WebP transparente é só apontar para outro
 * arquivo — o resto do caminho não muda (veja o blended no topo).
 */
const PHOTO_URL = nebulosaUrl;

/**
 * Lado do sprite da foto, em unidades de cena.
 *
 * O número sai da conta, não do olho. A câmera para a `WHITE_HOLE_STOP` (100) do
 * buraco branco — que é onde a nebulosa acende — e no epílogo o FOV abre de 55°
 * para 67°. A 100 unidades e 67°, o quadro tem ~235 × 132 unidades.
 *
 * Com `190`, o anel aceso — que ocupa ~38% da foto — fica em ~72 unidades, ou
 * **55% da altura do quadro**: presente, com céu sobrando nas laterais e atrás
 * do card de contato. A vinheta (abaixo) leva a borda da imagem a zero, então o
 * recorte reto não aparece mesmo com a foto cabendo dentro do quadro.
 */
export const NEBULA_PLANE = 190;

/**
 * Piso de preto e vinheta, aplicados no fragment shader.
 *
 * O céu da foto **não é preto**: a luminância média do arquivo é 34/255 (um
 * azul-marinho). Somado pelo blending aditivo, esse valor desenhava um
 * retângulo visível em volta da nebulosa. Cortar em `SKY_FLOOR` resolve — mas a
 * névoa vermelha externa da foto vive logo acima desse piso, então a vinheta é
 * que faz o trabalho de verdade: ela leva a borda a zero por distância, e
 * nebulosa que se dissolve no espaço é o que a foto já faz.
 */
const SKY_FLOOR = 0.035;
const SKY_KNEE = 0.07;
const VIGNETTE_INNER = 0.6;
const VIGNETTE_OUTER = 1.0;

/** Onde o miolo fica, em unidades de cena (0 = centro exato da foto). */
const NEBULA_CORE_Z = 2;

/** As cores da referência: âmbar na íris, ciano na pupila, vinho na névoa. */
const IRIS = '#f0a84a';
const IRIS_HOT = '#ffe0a8';
const PUPIL_BLUE = '#1b4f9c';
const ANNA_HOT = '#cfe6ff';
const HALO = '#c96a3a';

/** Contagens das camadas de partículas. */
const DUST_COUNT = 2200;
const STAR_COUNT = 520;
/** Quantas estrelas ganham as pontas de difração da foto. */
const SPIKED_SHARE = 0.07;

export interface Nebula {
  group: THREE.Group;
  /**
   * `emit` é o *afterglow* do epílogo (0 → 1): a nebulosa **nasce** quando o
   * branco do buraco branco baixa, no mesmo lugar onde ele estava. Antes disso
   * ela é invisível — o quadro do epílogo é só o buraco branco.
   */
  update(t: number, dt: number, focus: number, emit: number): void;
  dispose(): void;
}

/** Gerador determinístico: a nuvem precisa ser a mesma a cada montagem. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * 1. A foto. `createAdditivePhoto` monta o sprite e cuida do que a foto não
 * tem: o piso que joga o céu a zero e a vinheta que dissolve a borda (ver
 * `shared.ts`).
 *
 * `depthTest: false` porque é luz: o sprite é o fundo da cena final e não pode
 * ser cortado por nada que esteja entre ele e a câmera.
 */
function createPhoto(): THREE.Sprite {
  const { sprite } = createAdditivePhoto(PHOTO_URL, {
    plane: NEBULA_PLANE,
    cacheKey: 'nebula-photo',
    depthTest: false,
    // atrás de tudo: é a base, e as partículas são o que vive por cima
    renderOrder: 1,
    z: NEBULA_CORE_Z,
    skyFloor: SKY_FLOOR,
    skyKnee: SKY_KNEE,
    vignette: [VIGNETTE_INNER, VIGNETTE_OUTER],
  });
  // o `renderOrder` não identifica a foto (o halo também é sprite), e o tamanho
  // não serve: o halo é *maior* que a foto. A marca é o que faz o teste e quem
  // for depurar a cena acharem a peça certa
  sprite.userData.nebulaPhoto = true;
  return sprite;
}

/**
 * 2. O brilho: um halo quente que respira por trás da foto. Sem ele a nebulosa
 * lê como uma figura recortada colada no corredor; com ele, como uma luz que
 * está ali. O `focus` devolve o brilho quando a câmera está de frente.
 */
function createGlow(ctx: BuildContext): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: createDotTexture(HALO),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(NEBULA_PLANE * 1.15);
  sprite.position.z = NEBULA_CORE_Z - 1;
  sprite.renderOrder = 0;
  void ctx;
  return sprite;
}

/**
 * 3. A poeira: partículas que **saem do centro** para fora, em espiral fraca.
 *
 * É a camada que dá movimento — a foto é estática por natureza. Cada partícula
 * nasce perto do miolo, ganha raio com o tempo e morre na borda, nascendo de
 * novo: o mesmo fluxo permanente que o disco de acreção tem, em miniatura.
 */
function createDust(ctx: BuildContext): {
  points: THREE.Points;
  uniforms: Record<string, THREE.IUniform>;
} {
  const positions = new Float32Array(DUST_COUNT * 3);
  const angle = new Float32Array(DUST_COUNT);
  const born = new Float32Array(DUST_COUNT);
  const life = new Float32Array(DUST_COUNT);
  const spin = new Float32Array(DUST_COUNT);
  const bright = new Float32Array(DUST_COUNT);
  const radius = new Float32Array(DUST_COUNT);

  const random = seeded(31337);
  for (let i = 0; i < DUST_COUNT; i += 1) {
    angle[i] = random() * Math.PI * 2;
    // o instante de nascimento é espalhado pelo ciclo: a nuvem já está cheia no
    // primeiro quadro, sem "ligar" nada
    born[i] = random();
    life[i] = 4 + random() * 9;
    spin[i] = (random() - 0.5) * 1.5;
    bright[i] = 0.3 + Math.pow(random(), 1.5) * 0.7;
    radius[i] = NEBULA_PLANE * 0.46;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  geometry.setAttribute('aBorn', new THREE.BufferAttribute(born, 1));
  geometry.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geometry.setAttribute('aSpin', new THREE.BufferAttribute(spin, 1));
  geometry.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), NEBULA_PLANE);

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uIris: { value: new THREE.Color(IRIS) },
    uIrisHot: { value: new THREE.Color(IRIS_HOT) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aAngle;
      attribute float aBorn;
      attribute float aLife;
      attribute float aSpin;
      attribute float aBright;
      attribute float aRadius;

      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uIris;
      uniform vec3 uIrisHot;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        // o ciclo de vida roda no relógio: a nuvem nunca "esvazia"
        float age = fract(aBorn + uTime / aLife);
        float r = aRadius * age;

        // espiral fraca: o gás gira enquanto sai, como a foto mostra
        float theta = aAngle + age * aSpin + uTime * 0.05;

        vec2 p = vec2(cos(theta), sin(theta)) * r;
        // achatado, como a foto: a elipse é mais larga que alta
        vec3 pos = vec3(p.x, p.y * 0.66, 0.0);

        // o brilho acompanha o anel da íris: nasce quente no miolo e esfria na
        // ponta, onde a foto já é vermelha
        vec3 col = mix(uIrisHot, uIris, smoothstep(0.15, 0.7, age));

        // some nos dois extremos: entra suave, morre na borda
        float fade = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.72, 1.0, age));

        vColor = col;
        vAlpha = aBright * fade * uOpacity;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.2 + aBright * 3.4) * 420.0 / max(-mv.z, 0.001), 0.5, 9.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(uv));
        a *= a * a;
        if (a * vAlpha < 0.004) discard;
        gl_FragColor = vec4(vColor, a * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  void ctx;
  return { points, uniforms };
}

/**
 * 4a. O miolo: um azul profundo suave sobre a pupila da foto. A foto já tem o
 * vazio escuro; isto é só o **azul** que o pedido pede, e ele também define a
 * borda do disco.
 */
function createPupil(): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: createDotTexture(PUPIL_BLUE),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(NEBULA_PLANE * 0.42);
  sprite.position.z = NEBULA_CORE_Z + 1;
  sprite.renderOrder = 4;
  return sprite;
}

/**
 * 4b. A anã: o ponto azul-branco no centro exato. É o único ponto de brilho
 * duro da peça — o que faz o olho "olhar" para quem está na frente dele.
 */
function createWhiteDwarf(): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: createDotTexture(ANNA_HOT),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(NEBULA_PLANE * 0.075);
  sprite.position.z = NEBULA_CORE_Z + 2;
  sprite.renderOrder = 5;
  return sprite;
}

/**
 * 5. As estrelas: campo aditivo com tamanhos e brilhos bem variados, e as
 * quatro pontas de difração nas maiores (as azuis com halo da foto).
 *
 * A foto já tem estrelas, mas **parallax** e cintilação ela não tem — e é
 * exatamente aí que a camada paga: sem elas a nebulosa é uma imagem parada.
 */
function createStars(ctx: BuildContext): {
  points: THREE.Points;
  uniforms: Record<string, THREE.IUniform>;
} {
  const { palette } = ctx;
  const positions = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const spikes = new Float32Array(STAR_COUNT);
  const tones = new Float32Array(STAR_COUNT);

  const random = seeded(90210);
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const angle = random() * Math.PI * 2;
    // o campo cobre a foto inteira, com uma cauda para fora: as estrelas não
    // param na borda da imagem
    const spread = 0.55 + Math.pow(random(), 0.55) * 0.95;
    positions[i * 3] = Math.cos(angle) * NEBULA_PLANE * spread;
    positions[i * 3 + 1] = Math.sin(angle) * NEBULA_PLANE * spread * 0.82;
    positions[i * 3 + 2] = (random() - 0.5) * 30;

    const big = Math.pow(random(), 3.2);
    sizes[i] = 0.22 + big * 1.6;
    spikes[i] = big > 0.52 ? 1 : 0;
    // a maioria azul-branca, algumas quentes: é a variedade da foto
    tones[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aSpike', new THREE.BufferAttribute(spikes, 1));
  geometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), NEBULA_PLANE * 1.6);

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uSpiked: { value: SPIKED_SHARE },
    uCold: { value: new THREE.Color(palette.chalk).lerp(new THREE.Color('#7cc4ff'), 0.75) },
    uWarm: { value: new THREE.Color('#ffd9a8') },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aSpike;
      attribute float aTone;

      uniform float uTime;
      varying float vTwinkle;
      varying float vSpike;
      varying float vTone;

      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // cintila devagar, com fase por posição — sem alocar nada por quadro
        vTwinkle = 0.55 + 0.45 * sin(uTime * 0.8 + position.x * 0.6 + position.y * 0.35);
        vSpike = aSpike;
        vTone = aTone;
        gl_PointSize = clamp(aSize * 640.0 / max(-mv.z, 0.001), 0.5, 24.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCold;
      uniform vec3 uWarm;
      uniform float uOpacity;
      varying float vTwinkle;
      varying float vSpike;
      varying float vTone;

      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.05, length(q));

        // as quatro pontas de difração: um braço horizontal e um vertical,
        // afilando para fora do núcleo
        if (vSpike > 0.5) {
          float horizontal = smoothstep(0.5, 0.0, abs(q.y) * 13.0) *
                             smoothstep(0.5, 0.02, abs(q.x));
          float vertical = smoothstep(0.5, 0.0, abs(q.x) * 13.0) *
                           smoothstep(0.5, 0.02, abs(q.y));
          a = max(a, max(horizontal, vertical) * 0.7);
        }

        float alpha = a * vTwinkle * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(mix(uCold, uWarm, vTone), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, uniforms };
}

export function createNebula(ctx: BuildContext): Nebula {
  const group = new THREE.Group();

  const glow = createGlow(ctx);
  group.add(glow);

  const photo = createPhoto();
  group.add(photo);

  const { points: dust, uniforms: dustUniforms } = createDust(ctx);
  dust.renderOrder = 3;
  group.add(dust);

  const pupil = createPupil();
  group.add(pupil);

  const dwarf = createWhiteDwarf();
  group.add(dwarf);

  const { points: stars, uniforms: starUniforms } = createStars(ctx);
  stars.renderOrder = 2;
  group.add(stars);

  const breathe = (t: number) => 1 + 0.035 * Math.sin(t * 0.25);

  const update = (t: number, _dt: number, focus: number, emit: number) => {
    const lit = clamp(emit, 0, 1);

    // a foto acende junto com o afterglow; é ela que carrega a forma
    (photo.material as THREE.SpriteMaterial).opacity = lit;
    photo.scale.setScalar(NEBULA_PLANE * breathe(t));

    // o brilho de fundo é o que a foto não tem: é ele que faz a peça existir
    // como luz no corredor em vez de recorte colado
    (glow.material as THREE.SpriteMaterial).opacity = lit * (0.3 + 0.12 * focus);
    glow.scale.setScalar(NEBULA_PLANE * 1.15 * breathe(t));

    dustUniforms.uTime.value = t;
    dustUniforms.uOpacity.value = lit * 0.5;

    starUniforms.uTime.value = t;
    starUniforms.uOpacity.value = lit;

    // miolo e anã: o azul do vazio e o ponto de luz no centro exato
    (pupil.material as THREE.SpriteMaterial).opacity = lit * 0.5;
    pupil.scale.setScalar(NEBULA_PLANE * 0.42 * breathe(t));

    const dwarfMaterial = dwarf.material as THREE.SpriteMaterial;
    dwarfMaterial.opacity = lit * (0.85 + 0.15 * Math.abs(Math.sin(t * 0.7)));
    dwarf.scale.setScalar(NEBULA_PLANE * 0.075 * breathe(t));
  };

  return {
    group,
    update,
    dispose() {
      const material = (photo.material as THREE.SpriteMaterial).map;
      disposeObject(group);
      material?.dispose();
    },
  };
}
