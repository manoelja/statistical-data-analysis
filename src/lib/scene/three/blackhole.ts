/**
 * **Prólogo da jornada: o buraco negro.**
 *
 * A página abre no escuro. Um disco de acreção gira no eixo do corredor; a
 * câmera avança, o disco cresce até preencher o quadro, cruza o horizonte de
 * eventos (o clarão) e do outro lado as partículas do disco se espalham — é
 * assim que nasce a "universo de dados" do corredor.
 *
 * O truque que segura a cena é o **mesmo buffer servir aos dois mundos**: as
 * partículas do disco são deformadas no *vertex shader* (`uReveal`) para se
 * transformarem na poeira de dados. Não há corte nem fade: é a mesma nuvem de
 * pontos que muda de forma.
 *
 * Fisicamente honesta no essencial: o giro segue Kepler (ω ∝ r^-3/2, o
 * cisalhamento radial que faz parecer gás), o brilho é modulado por uma
 * assimetria tipo Doppler (o lado que se aproxima brilha mais) e o anel fino
 * junto à sombra é o anel de fótons. O *lensing* real exigiria um passe de
 * tela; aqui ele é sugerido pelo anel e por um halo aditivo.
 *
 * Nada aqui importa `journey.ts` — a fase chega como argumento, o que mantém o
 * grafo de cena sem ciclo de importação.
 */

import * as THREE from 'three';
import { clamp } from './math';
import { disposeObject } from './shared';
import type { BuildContext, Frame } from './types';

/** Raio da sombra (o que não emite luz). */
export const SHADOW_RADIUS = 9;
/** Disco de acreção: do limite externo do anel de fótons até a borda. */
export const DISK_INNER = 10;
export const DISK_OUTER = 42;

/**
 * Inclinação do disco. Tudo que é **plano** no buraco usa este valor: disco,
 * poeira capturada e anel de fótons. Sem compartilhar o ângulo, o anel (que nasce
 * no plano XY) aparece torto em relação ao disco, e a "borda acesa" deixa de
 * estar colada na sombra.
 */
export const DISK_TILT = -0.42;

const DISK_COUNT = 3200;
const STAR_COUNT = 760;

/** Fração das estrelas que o buraco negro puxa; o resto fica de fundo. */
const CAPTURED_SHARE = 0.66;

/**
 * O puxão é **autônomo**: não espera o scroll. Se o usuário parou, a gravidade
 * continua — é ela que puxa os pontos devagar para dentro do buraco enquanto a
 * página está parada.
 *
 * A curva é exponencial e tem **teto**. Isto importa: se o puxão fosse até 1, a
 * poeira seria consumida em poucos segundos e o buraco ficaria sem o que
 * puxar — o efeito morreria sozinho. Com teto, o disco é um fluxo permanente:
 * os pontos vão descendo sem parar, nascendo de novo na borda, e o buraco
 * sempre tem poeira em órbita.
 *
 * Os números são em segundos de tempo de cena.
 */
const PULL_DELAY = 0.4;
/** quanto o puxão cresce por segundo */
const PULL_RATE = 0.16;
/** teto do puxão: mantém sempre poeira sobrando */
const PULL_MAX = 0.62;

/** Quão forte o buraco segura a poeira agora: 0 → `PULL_MAX`, só com o relógio. */
export function pullAt(time: number): number {
  return PULL_MAX * (1 - Math.exp(-Math.max(0, time - PULL_DELAY) * PULL_RATE));
}

/** Fase do prólogo, calculada (e testada) em `journey.holePhase`. */
export interface HolePhase {
  /** 0 → 1 enquanto a câmera se aproxima do buraco */
  approach: number;
  /** 0 → 1 no pico do cruzamento do horizonte (o clarão) */
  flare: number;
  /** 0 → 1 depois do cruzamento (o disco vira poeira) */
  reveal: number;
  /** peso do olhar: 1 = mirando o buraco, 0 = olhando o corredor */
  aim: number;
}

export interface BlackHole {
  /** o buraco no mundo (plantado no eixo, em z = 0) */
  group: THREE.Group;
  /** véu de clarão, preso à câmera — some com ele do quadro */
  flare: THREE.Mesh;
  /** fundo escuro do prólogo, preso à câmera (some quando o dado se forma) */
  void: THREE.Mesh;
  update(frame: Frame, phase: HolePhase, camera: THREE.PerspectiveCamera): void;
  dispose(): void;
}

/** Amostra os raios do disco com densidade maior perto da sombra. */
function sampleRadius(random: () => number): number {
  const t = Math.pow(random(), 1.7);
  return DISK_INNER + t * (DISK_OUTER - DISK_INNER);
}

/**
 * O disco: um `Points` cujas posições são calculadas no vertex shader.
 * `uReveal` é o truque do "outro universo" — as partículas são empurradas
 * para fora e apagadas, virando a poeira do corredor.
 */
function createDisk(ctx: BuildContext): {
  points: THREE.Points;
  uniforms: Record<string, THREE.IUniform>;
} {
  const { palette } = ctx;
  const positions = new Float32Array(DISK_COUNT * 3);
  const radius = new Float32Array(DISK_COUNT);
  const angle = new Float32Array(DISK_COUNT);
  const thickness = new Float32Array(DISK_COUNT);
  const bright = new Float32Array(DISK_COUNT);

  let seed = 1337;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < DISK_COUNT; i += 1) {
    const r = sampleRadius(random);
    radius[i] = r;
    angle[i] = random() * Math.PI * 2;
    thickness[i] = (random() - 0.5) * (1.2 + r * 0.05);
    bright[i] = 0.35 + random() * 0.65;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  geometry.setAttribute('aThick', new THREE.BufferAttribute(thickness, 1));
  geometry.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), DISK_OUTER * 1.6);

  const hot = new THREE.Color(palette.chalk).multiplyScalar(2.6);
  const mid = new THREE.Color(palette.yellow).multiplyScalar(1.9);
  const cold = new THREE.Color(palette.orange).multiplyScalar(1.2);

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uOpacity: { value: 1 },
    uInner: { value: DISK_INNER },
    uOuter: { value: DISK_OUTER },
    uHot: { value: hot },
    uMid: { value: mid },
    uCold: { value: cold },
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
      uniform float uReveal;
      uniform float uOpacity;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uHot;
      uniform vec3 uMid;
      uniform vec3 uCold;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float r = aRadius;
        // Kepler: o raio interno gira muito mais rápido que o externo
        float omega = pow(max(r, 0.001), -1.5) * 26.0;
        float theta = aAngle + uTime * omega;

        // "outro universo": ao revelar, o disco explode para fora e apaga
        float rr = r * (1.0 + uReveal * 2.8);
        vec3 pos = vec3(
          rr * cos(theta),
          rr * sin(theta),
          aThick * (1.0 + uReveal * 10.0)
        );

        // assimetria tipo Doppler: um lado do disco brilha mais que o outro
        float side = 0.5 + 0.5 * sin(theta * 0.6 + 0.7);
        float doppler = 0.30 + 1.70 * side;

        float u = clamp((r - uInner) / max(uOuter - uInner, 0.001), 0.0, 1.0);
        vec3 col = mix(uHot, uMid, smoothstep(0.0, 0.42, u));
        col = mix(col, uCold, smoothstep(0.38, 1.0, u));
        col *= doppler * aBright;

        vColor = col * (1.0 - uReveal * 0.75);
        vAlpha = uOpacity * (1.0 - uReveal) * (0.45 + 0.55 * side);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aBright * 210.0 / max(-mv.z, 0.001), 0.4, 8.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.05, d);
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
 * Estrelas de fundo **e a poeira que o buraco negro puxa**.
 *
 * São dois conjuntos no mesmo `Points`: as estrelas de fundo ficam onde estão
 * (dão o "espaço"), e a poeira capturada vive no plano do disco e desce em
 * espiral até o horizonte de eventos. A velocidade angular é de novo Kepler,
 * então o ponto mais próximo do buraco gira bem mais rápido que o distante —
 * é esse cisalhamento que faz o puxão parecer gravidade, e não uma animação.
 *
 * O quanto o buraco puxa é `uPull`, e ele é **função do tempo de cena**
 * (`pullAt`) — não do scroll: a gravidade não espera o usuário. Começa fraca,
 * vai ficando mais forte e acelera à medida que os pontos se aproximam. Tudo
 * no vertex shader — nada por quadro na CPU.
 */
function createStarfield(ctx: BuildContext): {
  points: THREE.Points;
  uniforms: Record<string, THREE.IUniform>;
} {
  const { palette } = ctx;
  const positions = new Float32Array(STAR_COUNT * 3);
  const radius = new Float32Array(STAR_COUNT);
  const angle = new Float32Array(STAR_COUNT);
  const height = new Float32Array(STAR_COUNT);
  const fall = new Float32Array(STAR_COUNT);
  const speed = new Float32Array(STAR_COUNT);
  const seed = new Float32Array(STAR_COUNT);

  let s = 99;
  const random = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };

  for (let i = 0; i < STAR_COUNT; i += 1) {
    speed[i] = 0.3 + random() * 0.9;
    seed[i] = random();

    if (random() < CAPTURED_SHARE) {
      // poeira capturada: no plano do disco, de dentro para fora
      const r = SHADOW_RADIUS * 1.15 + Math.pow(random(), 1.35) * (DISK_OUTER * 3.6);
      radius[i] = r;
      angle[i] = random() * Math.PI * 2;
      height[i] = (random() - 0.5) * (1.5 + r * 0.05);
      fall[i] = 1;
    } else {
      // estrela de fundo: numa casca esférica, parada
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const r = 420 + random() * 560;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      fall[i] = 0;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  geometry.setAttribute('aHeight', new THREE.BufferAttribute(height, 1));
  geometry.setAttribute('aFall', new THREE.BufferAttribute(fall, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1100);

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uPull: { value: 0 },
    uOpacity: { value: 1 },
    uSize: { value: 3.1 },
    uInner: { value: SHADOW_RADIUS * 0.98 },
    uColor: { value: new THREE.Color(palette.chalk) },
    uHot: { value: new THREE.Color('#fff4dd') },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aRadius;
      attribute float aAngle;
      attribute float aHeight;
      attribute float aFall;
      attribute float aSpeed;
      attribute float aSeed;

      uniform float uTime;
      uniform float uPull;
      uniform float uOpacity;
      uniform float uSize;
      uniform float uInner;
      uniform vec3 uColor;
      uniform vec3 uHot;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 pos = position;
        float fade = 1.0;
        float hot = 0.0;

        if (aFall > 0.5) {
          // queda cíclica: nasce na borda e se renasce, como o disco real.
          // A velocidade é baixa de propósito — um ponto leva de 6 a 24 s para
          // descer do seu raio até o horizonte. É um arrastar, não um tiro.
          float inf = fract(aSeed + uTime * aSpeed * (0.04 + uPull * 0.16));
          // com o puxão fraco o ponto fica quase onde nasceu; puxado, desce
          float r = mix(aRadius, uInner, inf * uPull);
          // Kepler: perto do horizonte a espiral acelera muito
          float omega = pow(max(r, 0.001), -0.75) * 5.0 * (0.4 + uPull * 2.4);
          float theta = aAngle + uTime * omega * aSpeed;
          pos = vec3(r * cos(theta), aHeight * (0.35 + r * 0.02), r * sin(theta));
          // aparece na borda e desaparece ao encostar no buraco
          fade = mix(1.0, smoothstep(0.0, 0.2, inf) * (1.0 - smoothstep(0.8, 1.0, inf)), uPull);
          // a queda esquenta o ponto
          hot = uPull * (1.0 - inf);
        }

        vColor = mix(uColor, uHot, hot * 0.8) * (1.0 + hot * 1.4);
        vAlpha = uOpacity * (0.3 + 0.7 * fade);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        // pontinho mesmo: o teto em px é baixo de propósito — a poeira tem de
        // ler como poeira, não como bola
        gl_PointSize = clamp(uSize * (1.0 + hot * 0.5) * 340.0 / max(-mv.z, 1.0), 0.4, 4.2);
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
 * O véu de clarão. Fica preso à câmera (entra em `camera.children`) e cobre o
 * quadro inteiro: é o "flash" branco do cruzamento do horizonte.
 */
function createFlare(): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#fff6e2'),
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

/**
 * O vazio do prólogo: um fundo preto preso à câmera. Sem ele, o buraco negro
 * desdobrado sobre o gradiente do corredor e o clarão branco — que é *aditivo* —
 * simplesmente desapareceriam. Ele também faz a travessia acontecer no escuro
 * de verdade, e some junto com a revelação.
 *
 * `voidStrength` deixa o `journey` baixar a cobertura no retrato, onde o vazio
 * chapado lia como "quebrou" em vez de "espaço". No desktop fica em 1,0.
 */
function createVoid(): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#04060b'),
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.position.set(0, 0, -1.3);
  // desenhado antes de tudo, sem testar profundidade: é o fundo do quadro
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

export function createBlackHole(ctx: BuildContext): BlackHole {
  const { palette } = ctx;
  const group = new THREE.Group();

  /** Cobertura do vazio; o `journey` a baixa no retrato. Ver `BlackHole`. */
  

  // A câmera cruza este sólido de propósito — o teste "a câmera nunca
  // atravessa uma peça" pula o que estiver marcado assim.
  group.userData.letCameraPass = true;

  // ---- sombra: a esfera que não emite nada ----
  // A sombra é a única peça **opaca** do buraco, e a câmera voa direto nela.
  // Deixá-la sólida faz o quadro virar uma parede preta no instante em que o anel
  // de fótons passa pela borda: a esfera cresce até tomar a tela e, se o
  // usuário parar de rolar ali, ela fica. Por isso ela **evapora** antes de a
  // câmera encostar — quem toma o quadro adiante é o clarão, não uma bola preta.
  const shadow = new THREE.Mesh(
    new THREE.SphereGeometry(SHADOW_RADIUS, 40, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, fog: false }),
  );
  shadow.userData.letCameraPass = true;
  group.add(shadow);

  // ---- anel de fótons: a borda fina e acesa colada na sombra ----
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(DISK_INNER + 0.4, 0.55, 16, 128),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.chalk).multiplyScalar(2.2),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  ring.userData.letCameraPass = true;
  // o anel é a borda interna do disco: nasce no mesmo plano que ele (XY) e
  // recebe a **mesma** inclinação, senão lê como um aro torto atrás da sombra
  ring.rotation.x = DISK_TILT;
  group.add(ring);

  // ---- halo aditivo: REMOVIDO ----
  // Havia um sprite de 120 unidades com `palette.yellow` aqui, sugerido como
  // "lensing". Na prática lia como uma bola amarela chapada sobre o buraco —
  // foi trocado pela poeira real sendo puxada em espiral, que é a mesma ideia
  // com partículas de verdade em vez de uma mancha.

  // ---- disco de acreção + estrelas/poeira capturada ----
  const { points: disk, uniforms } = createDisk(ctx);
  // leve inclinação: vemos o disco um pouco de cima, como na referência
  disk.rotation.x = DISK_TILT;
  group.add(disk);

  const { points: stars, uniforms: starUniforms } = createStarfield(ctx);
  // a poeira cai no mesmo plano inclinado do disco, senão as duas espirais
  // discordariam do ponto de vista
  stars.rotation.x = DISK_TILT;
  group.add(stars);

  const flare = createFlare();
  const void_ = createVoid();
  const center = new THREE.Vector3();

  const update = (frame: Frame, phase: HolePhase, camera: THREE.PerspectiveCamera) => {
    uniforms.uTime.value = frame.t;
    uniforms.uReveal.value = phase.reveal;
    // o disco some no cruzamento e não volta
    uniforms.uOpacity.value = clamp(1 - phase.reveal * 1.2, 0, 1);

    // O puxão vem do relógio, não do scroll: a gravidade segue o seu curso
    // enquanto o usuário só assiste (ou rola a página para outra etapa).
    const pull = pullAt(frame.t);
    starUniforms.uTime.value = frame.t;
    starUniforms.uPull.value = pull;
    // as estrelas de fundo continuam existindo depois que a poeira some
    starUniforms.uOpacity.value = 1 - phase.reveal * 0.75;

    (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * clamp(1 - phase.flare, 0, 1);

    // A sombra evapora com a aproximação. Solta antes da câmera chegar perto o
    // bastante para a esfera cobrir o quadro inteiro.
    const distance = camera.position.distanceTo(center.setFromMatrixPosition(group.matrixWorld));
    const solid = clamp((distance - DISK_INNER * 1.05) / (SHADOW_RADIUS * 5), 0, 1);
    (shadow.material as THREE.MeshBasicMaterial).opacity = solid;
    // totalmente apagada some também da profundidade: senão continuaria
    // ocultando o disco do outro lado sem ser visível
    shadow.visible = solid > 0.02;

    // os dois véus cobrem o frustum inteiro, qualquer que seja o fov do quadro
    const dist = Math.abs(void_.position.z);
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
    const width = height * camera.aspect;
    flare.scale.set(width * 1.2, height * 1.2, 1);
    void_.scale.set(width * 1.2, height * 1.2, 1);

    // o clarão em três pernas: ataque rápido, sustentação (a câmera se
    // recentra escondida atrás do branco) e queda longa
    (flare.material as THREE.MeshBasicMaterial).opacity = clamp(phase.flare * 0.94, 0, 1);
    // o vazio cai junto com a queda: preto → branco → corredor
    (void_.material as THREE.MeshBasicMaterial).opacity = clamp(1 - phase.reveal * 1.08, 0, 1);
  };

  return {
    group,
    flare,
    void: void_,
    update,
    dispose() {
      disposeObject(group);
      for (const veil of [flare, void_]) {
        (veil.material as THREE.Material).dispose();
        veil.geometry.dispose();
      }
    },
  };
}
