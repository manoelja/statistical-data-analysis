/**
 * A **jornada** 3D: a página é um mergulho em profundidade com cards.
 *
 * A câmera não orbita um objeto — ela *viaja*. O scroll da página vira o eixo
 * Z e, enquanto a câmera atravessa o corredor, um **card** por etapa desliza
 * para a tela: Horizonte · Visão Geral · Parte 1 · Parte 2 · Resultados ·
 * Formulário · Contato.
 *
 * O percurso começa **atrás da origem**: os primeiros ~14% do scroll são o
 * prólogo do buraco negro (cruzamento do horizonte de eventos) e só depois o
 * corredor de exhibitions. `JOURNEY_LEAD` é essa reta de partida, `depthAt` é
 * a única ponte entre scroll e Z.
 *
 * Cada etapa tem também o seu **elemento 3D** — os mesmos seis do antigo
 * laboratório (tabela de frequências, dados, histograma, nuvem de dispersão,
 * cubo de fórmulas e diagrama de Venn), reaproveitados como cenas do corredor.
 *
 * Como no resto do motor de cena, nada aqui desenha: o `journey` monta o grafo
 * de objetos e sabe avançar a animação (quem renderiza é o `viewer`). Os
 * parâmetros dos sliders continuam vindo do estado compartilhado
 * (`scene/store`) — mexer no laboratório muda a cena.
 *
 * Também vive aqui, em funções puras e testadas, a **coreografia dos cards**
 * (quando cada um entra, quando sai e com que deslocamento — `cardPose`), o
 * ponto de chegada de cada etapa (`chapterAnchor`) e a coreografia do buraco
 * negro (`holePhase`).
 */

import * as THREE from 'three';
import { drift } from './noise';
import type { ChalkPalette } from './chalk';
import { getSceneParams, type SceneParams } from './store';
import { createChalkSprite, createDotTexture, createGradientTexture } from './three/chalkText';
import { createFloatingFormula } from './three/formulas';
import { clamp, damp, lerp } from './three/math';
import { disposeObject } from './three/shared';
import { createBlackHole, type HolePhase } from './three/blackhole';
import { createCubeExhibit } from './three/cube';
import { createDiceExhibit } from './three/dice';
import { createFrequencyExhibit } from './three/frequency';
import { createHistogramExhibit } from './three/histogram';
import { createScatterExhibit } from './three/scatter';
import { createVennExhibit } from './three/venn';
import type { BuildContext, Exhibit, Frame } from './three/types';

/** Profundidade do corredor defim dos seis capítulos: 0 → -2500. */
export const JOURNEY_DEPTH = 2500;

/**
 * Reta de partida do prólogo: a câmera começa *atrás* da origem e o buraco
 * negro fica na origem. São ~14% do scroll de "queda" antes do capítulo 1.
 */
export const JOURNEY_LEAD = 400;

/** Profundidade total da viagem, do ponto de partida ao fim do corredor. */
export const JOURNEY_SPAN = JOURNEY_LEAD + JOURNEY_DEPTH;

/** Centro do buraco negro, no eixo do corredor. */
export const HOLE_Z = 0;

/** Duração do fade-in/out dos cards, em fração do progresso total. */
export const CARD_FADE = 0.04;

/** Altura de voo da câmera — acima das peças, para não atravessá-las. */
const CAMERA_HEIGHT = 12;

/** Distância à frente em que o elemento 3D da etapa é plantado. */
const EXHIBIT_LEAD = 36;

/** Os elementos foram enquadrados a ~10 unidades no laboratório antigo. */
const EXHIBIT_SCALE = 2.6;

/** Altura do elemento — mantém a peça no centro do quadro da câmera. */
const EXHIBIT_LIFT = 2;

/**
 * Alcance e força com que o buraco negro puxa a poeira da própria página. A
 * força é baixa: é um arrastar lento e contínuo, não um engolir.
 */
const DUST_PULL_RADIUS = 78;
const DUST_PULL_STRENGTH = 8;

/**
 * Teto do campo de visão. A base do FOV se adapta à tela (55° no largo, 72° no
 * estreito, para o corredor caber) e a aproximação soma 16° nos dois — sem
 * este teto o retrato abriria 88°, muito espaço vazio em volta de uma lâmina de
 * disco. No desktop a soma dá 71° e o teto nem chega a ser consultado.
 */
const MAX_FOV = 78;

/** Progresso em que a câmera cruza o horizonte de eventos. */
export const HOLE_CROSSING = JOURNEY_LEAD / JOURNEY_SPAN;

/**
 * Progresso em que o disco termina de virar poeira. Precisa acontecer *antes*
 * do primeiro card entrar (o teste abaixo cobra essa ordem): senão o capítulo 1
 * aparece por cima de um disco que ainda não virou o universo de dados.
 */
export const HOLE_REVEAL_END = 0.21;

/**
 * As três pernas do clarão, em progresso. Um clarão de cinema não é uma gaussiana
 * — é **ataque rápido, sustentação e queda longa**:
 *
 * - a subida começa *antes* da travessia e estoura no horizonte;
 * - a sustentação existe para a câmera voltar ao corredor **escondida atrás do
 *   branco** (senão o "snap" do fov e do olhar aparece e denuncia o truque);
 * - a queda é a mais longa, e é nela que o disco vira poeira e o capítulo 1
 *   se forma — o texto acende enquanto o branco ainda está alto.
 */
const FLASH_ATTACK = 0.024;
const FLASH_HOLD = 0.022;

/** Fim da sustentação — daqui em diante é queda, e a revelação começa. */
const HOLE_REVEAL_START = HOLE_CROSSING + FLASH_ATTACK / 2 + FLASH_HOLD;

/** A queda é a revelação: os dois duram exatamente a mesma janela. */
const FLASH_RELEASE = HOLE_REVEAL_END - HOLE_REVEAL_START;

/** `smootherstep`: ataque e queda sem jerk nas pontas. */
function ease(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * **O rebobininho.** Ao entrar na bola preta — a sombra do buraco — a câmera dá
 * um passo para trás, mostra de onde veio, e desce de novo. Como uma queda no
 * tempo: você atravessou, e a gravidade devolve a sua imagem antes de te deixar
 * seguir.
 *
 * Três pernas (puxa atrás, segura, volta), em segundos de tempo de cena.
 */
const REWIND_IN = 0.34;
const REWIND_HOLD = 0.3;
const REWIND_OUT = 0.95;
/** Quantas unidades a câmera recua — o bastante para reenquadrar o disco. */
export const REWIND_DISTANCE = 130;

/** A partir de quanto o clarão já baixou o rebobininho fica visível. */
const REWIND_FLARE_GATE = 0.2;

/** Total do rebosiniho, em segundos. */
export const REWIND_SPAN = REWIND_IN + REWIND_HOLD + REWIND_OUT;

/**
 * O envelope do rebobininho em função do tempo desde o disparo: 0 → 1 → 0.
 * Pura de propósito — é testável sem GPU, como o resto da coreografia.
 */
export function rewindEnvelope(elapsed: number): number {
  if (elapsed <= 0) return 0;
  if (elapsed < REWIND_IN) return ease(elapsed / REWIND_IN);
  if (elapsed < REWIND_IN + REWIND_HOLD) return 1;
  const out = (elapsed - REWIND_IN - REWIND_HOLD) / REWIND_OUT;
  return out >= 1 ? 0 : 1 - ease(out);
}

export type CardSide = 'left' | 'right' | 'center';

export interface JourneyChapter {
  /** id do marcador no DOM (alvo de âncora do navbar) */
  id: string;
  /** título do card */
  title: string;
  /** uma linha sobre a etapa */
  tagline: string;
  /** centro da cena no eixo Z */
  z: number;
  /** progresso (0..1) em que o card começa a aparecer */
  enter: number;
  /** progresso (0..1) em que o card termina de desaparecer */
  exit: number;
  /** de que lado fica o elemento 3D (-1 esquerda · 1 direita) */
  side: -1 | 1;
  /** onde o card fica na tela (o oposto do elemento, para não se cobrirem) */
  cardSide: CardSide;
}

/**
 * As seis etapas do corredor. As janelas são medidas em progresso de scroll e
 * deixam um respiro entre um card e o seguinte (tempo de a câmera "viajar").
 *
 * As profundidades começam em -420, bem depois do prólogo: com `JOURNEY_LEAD`
 * as âncoras ficam em 0,28 · 0,41 · 0,55 · 0,68 · 0,81 · 0,94 — quase
 * uniformes, porque o espaçamento do corredor também é. O `enter` da primeira
 * etapa é 0,225, depois de `HOLE_REVEAL_END`: o capítulo 1 só aparece quando o
 * "outro universo" dos dados já está formado.
 */
export const JOURNEY_CHAPTERS: JourneyChapter[] = [
  {
    id: 'visao',
    title: 'Visão Geral',
    tagline: 'Da teoria dos dados à prática',
    z: -420,
    enter: 0.225,
    exit: 0.34,
    side: 1,
    cardSide: 'left',
  },
  {
    id: 'probabilidade',
    title: 'Parte 1 — Probabilidade',
    tagline: 'Binomial, Poisson e Normal',
    z: -800,
    enter: 0.355,
    exit: 0.47,
    side: -1,
    cardSide: 'right',
  },
  {
    id: 'inferencia',
    title: 'Parte 2 — Inferência',
    tagline: 'Intervalos de confiança e testes de hipótese',
    z: -1180,
    enter: 0.49,
    exit: 0.6,
    side: 1,
    cardSide: 'left',
  },
  {
    id: 'resultados',
    title: 'Resultados',
    tagline: 'O intervalo cobriu o parâmetro?',
    z: -1560,
    enter: 0.62,
    exit: 0.73,
    side: -1,
    cardSide: 'right',
  },
  {
    id: 'formulario',
    title: 'Formulário',
    tagline: 'A "cola" que resolve tudo',
    z: -1940,
    enter: 0.755,
    exit: 0.86,
    side: 1,
    cardSide: 'left',
  },
  {
    id: 'contato',
    title: 'Contato',
    tagline: 'SINASC/DataSUS · R 4.6.0',
    z: -2320,
    enter: 0.895,
    exit: 1,
    side: -1,
    cardSide: 'center',
  },
];

/**
 * A única ponte entre o scroll e o eixo Z: a câmera parte de `+JOURNEY_LEAD`
 * (atrás do buraco negro) e termina em `-JOURNEY_DEPTH`.
 */
export function depthAt(progress: number): number {
  return JOURNEY_LEAD - clamp(progress, 0, 1) * JOURNEY_SPAN;
}

/** O inverso de `depthAt`: em que scroll a câmera alcança a profundidade `z`. */
export function progressAt(z: number): number {
  return clamp((JOURNEY_LEAD - z) / JOURNEY_SPAN, 0, 1);
}

/**
 * Coreografia do prólogo, em função do scroll. Quatro valores, todos 0 → 1:
 *
 * - `approach` — aproximação: o disco cresce, a câmera desce ao plano dele e o
 *   FOV abre. Volta a zero **durante a sustentação do clarão**, para que o
 *   corredor já esteja enquadrado quando o branco começa a cair.
 * - `flare`    — o clarão: ataque, sustentação, queda (não uma gaussiana)
 * - `reveal`   — o disco se espalha virando a poeira do corredor (na queda)
 * - `aim`      — para onde a câmera olha (buraco × corredor)
 *
 * É pura de propósito: o `reduced-motion` precisa do mesmo roteiro, e o
 * `uReveal` do shader é dirigido por ela, não por relógio.
 */
export function holePhase(progress: number): HolePhase {
  const p = clamp(progress, 0, 1);
  const cross = HOLE_CROSSING;

  const rise = ease(clamp(p / cross, 0, 1));
  // a câmera e o olhar voltam já dentro da sustentação ( invisíveis no branco )
  const settle = ease(clamp((p - cross) / (FLASH_HOLD / 2 + FLASH_ATTACK / 2), 0, 1));
  const approach = p <= cross ? rise : 1 - settle;

  // clarão: sobe antes da travessia, segura, e cai devagar. O ataque é
  // centrado no horizonte, então não há degrau entre os dois lados dele.
  const attackStart = cross - FLASH_ATTACK / 2;
  const attackPeak = cross + FLASH_ATTACK / 2;
  let flare: number;
  if (p < attackPeak) {
    flare = ease((p - attackStart) / FLASH_ATTACK);
  } else if (p < HOLE_REVEAL_START) {
    flare = 1;
  } else {
    flare = 1 - ease((p - HOLE_REVEAL_START) / FLASH_RELEASE);
  }

  // o disco só se abre quando o branco já cobre o quadro
  const reveal = ease(clamp((p - HOLE_REVEAL_START) / (HOLE_REVEAL_END - HOLE_REVEAL_START), 0, 1));

  const aim = p <= cross ? 0.35 + 0.65 * rise : 1 - settle;

  return { approach, flare, reveal, aim };
}

/**
 * Opacidade da placa-título do prólogo. A página abre no escuro e ela some
 * antes do cruzamento — quando o disco vira poeira, o capítulo 1 assume.
 */
export function prologueOpacity(progress: number): number {
  const { approach, reveal } = holePhase(progress);
  return clamp((1 - approach * 1.35) * (1 - reveal), 0, 1);
}

/** Índice da etapa cujo centro de janela está mais perto de um progresso. */
export function chapterIndexAt(progress: number): number {
  const value = clamp(progress, 0, 1);
  let best = 0;
  let bestDistance = Infinity;
  JOURNEY_CHAPTERS.forEach((chapter, index) => {
    const middle = (chapter.enter + chapter.exit) / 2;
    const distance = Math.abs(value - middle);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

export interface CardPose {
  /** 0 = escondido, 1 = totalmente visível */
  opacity: number;
  /** deslocamento horizontal em % da largura do card (negativo = esquerda) */
  shift: number;
  /** escala (o card de contato cresce ao aparecer) */
  scale: number;
}

/**
 * Posição/opacidade de um card em função do progresso de scroll.
 *
 * Cada etapa tem uma janela `[enter, exit]`: dentro dela o card fica parado e
 * opaco; antes, desliza de fora; depois, desliza para fora — nos dois casos
 * pela borda de onde veio, o que dá a sensação de o card pertencer àquela
 * profundidade.
 */
export function cardPose(index: number, progress: number): CardPose {
  const chapter = JOURNEY_CHAPTERS[clamp(Math.round(index), 0, JOURNEY_CHAPTERS.length - 1)];
  if (!chapter) return { opacity: 0, shift: 0, scale: 1 };

  const value = clamp(progress, 0, 1);
  // Uma etapa que abre em `enter = 0` nasce visível (a janela não tem "antes").
  // O de contato (`exit = 1`) é um painel: não some dentro da jornada.
  const enterStart = chapter.enter <= 0 ? Number.NEGATIVE_INFINITY : chapter.enter;
  const exitEnd = chapter.exit >= 1 ? Number.POSITIVE_INFINITY : chapter.exit;
  // -1 = ainda não chegou · 0 = no lugar · 1 = já passou
  let phase = 0;
  let opacity = 1;

  if (value < enterStart) {
    phase = -1;
    opacity = 0;
  } else if (value < enterStart + CARD_FADE) {
    const t = (value - enterStart) / CARD_FADE;
    phase = -(1 - t);
    opacity = t;
  } else if (value > exitEnd) {
    phase = 1;
    opacity = 0;
  } else if (value > exitEnd - CARD_FADE) {
    const t = (value - (exitEnd - CARD_FADE)) / CARD_FADE;
    phase = t;
    opacity = 1 - t;
  }

  const lateral = chapter.cardSide === 'center' ? 0 : chapter.cardSide === 'left' ? -1 : 1;
  const eased = phase * phase * (3 - 2 * Math.abs(phase));

  return {
    opacity: clamp(opacity, 0, 1),
    shift: lateral * eased * 26,
    scale: 1 + Math.abs(eased) * 0.02,
  };
}

/** Progresso em que a câmera chega ao centro da etapa `index`. */
export function chapterAnchor(index: number): number {
  const chapter = JOURNEY_CHAPTERS[clamp(Math.round(index), 0, JOURNEY_CHAPTERS.length - 1)];
  return progressAt(chapter.z);
}

interface ScenePart {
  group: THREE.Group;
  /** z da etapa a que a peça pertence */
  viewZ: number;
  /** de que lado a peça é plantada (0 = no eixo, ex.: o texto de entrada) */
  side: number;
  /** escala base (a responsiva é aplicada por cima) */
  scale: number;
  /**
   * `reveal` é a fase da revelação do prólogo: só a entrada o usa, para acender
   * o título junto com a poeira. As peças do corredor a ignoram.
   */
  update(t: number, dt: number, focus: number, reveal: number): void;
}

export interface Journey {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** avança a animação até a profundidade pedida (z negativo) */
  advance(dt: number, targetZ: number, pointer: { x: number; y: number }): void;
  setAspect(aspect: number): void;
  setPlaying(playing: boolean): void;
  refreshText(): void;
  dispose(): void;
}

/** Luminância perceptual do hex — decide o tema claro/escuro da cena. */
function isDarkPalette(hex: string): boolean {
  const color = new THREE.Color(hex);
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b < 0.25;
}

/* ============================================================
   Entrada: texto gigante + símbolos matemáticos
   ============================================================ */

function buildEntrance(ctx: BuildContext): ScenePart {
  const group = new THREE.Group();
  const palette = ctx.palette;

  const { sprite, plate } = createChalkSprite(
    [
      { text: 'DATA', size: 150, color: palette.chalk, gap: 0.02 },
      { text: 'SCIENCE', size: 150, color: palette.cyan, gap: 0 },
    ],
    { worldHeight: 26, align: 'left' },
  );
  ctx.plates.push(plate);
  sprite.position.set(8, 20, 40);
  group.add(sprite);

  const symbols = [
    '\\sum_{i=1}^{n} x_i',
    '\\bar{x} \\pm z\\sigma',
    'P(A \\cap B)',
    'z = (x - \\mu)/\\sigma',
    'n! / (k!(n-k)!)',
    'H_{0}: \\mu = \\mu_{0}',
  ].map((text, index) => {
    const made = createFloatingFormula(ctx, {
      text,
      color: [palette.yellow, palette.pink, palette.green, palette.cyan, palette.orange, palette.blue][index % 6],
      position: [index % 2 === 0 ? -22 - index * 2 : 22 + index * 2, -4 + (index % 3) * 7, -10 - index * 22],
      height: 2.4,
      amplitude: 1.6,
      seed: index * 13.7,
    });
    group.add(made.sprite);
    return made;
  });

  return {
    group,
    viewZ: -180,
    side: 0,
    scale: 1,
    update(t, _dt, _focus, reveal) {
      symbols.forEach((symbol) => symbol.update(t));
      // o título "acende" com a poeira: entra no meio da queda do clarão,
      // quando o branco ainda está alto o bastante para ler como revelação
      const ignite = 0.15 + 0.85 * clamp(reveal * 1.6, 0, 1);
      sprite.material.opacity = ignite * (0.86 + 0.14 * Math.abs(drift(t * 0.4, 3)));
      symbols.forEach((symbol) => {
        symbol.sprite.material.opacity = ignite * 0.9;
      });
    },
  };
}

/* ============================================================
   Elemento 3D de uma etapa (reaproveita os seis do laboratório)
   ============================================================ */

function buildExhibitPart(
  exhibit: Exhibit,
  chapter: JourneyChapter,
  context: {
    isPlaying: () => boolean;
    pointer: () => { x: number; y: number };
  },
): ScenePart {
  const group = new THREE.Group();
  group.add(exhibit.group);

  return {
    group,
    viewZ: chapter.z,
    side: chapter.side,
    scale: EXHIBIT_SCALE,
    update(t, dt, focus, reveal) {
      const frame: Frame = {
        t,
        dt,
        playing: context.isPlaying(),
        pointer: context.pointer(),
        params: getSceneParams(),
        focus,
      };
      exhibit.update(frame);
      void reveal;
    },
  };
}

/* ============================================================
   Montagem da jornada
   ============================================================ */

export function buildJourney(palette: ChalkPalette, params: SceneParams): Journey {
  const scene = new THREE.Scene();
  const dark = isDarkPalette(palette.board1);

  const background = createGradientTexture(
    dark
      ? [
          [0, '#05070f'],
          [0.45, '#0a1226'],
          [1, '#04050a'],
        ]
      : [
          [0, '#fdfbf6'],
          [0.55, '#f2ece0'],
          [1, '#e4dccb'],
        ],
  );
  scene.background = background;
  // FogExp2: o que está longe perde contraste e "afunda" na profundidade
  scene.fog = new THREE.FogExp2(new THREE.Color(palette.board1), dark ? 0.0034 : 0.0026);

  const camera = new THREE.PerspectiveCamera(55, 1.6, 0.1, 620);
  camera.position.set(0, CAMERA_HEIGHT, JOURNEY_LEAD);

  // ---- luzes: ambiente + hemisférica + direcional + uma por etapa ----
  scene.add(new THREE.AmbientLight(palette.chalk, dark ? 0.6 : 0.95));
  scene.add(new THREE.HemisphereLight(palette.cyan, palette.board1, dark ? 0.5 : 0.75));

  const key = new THREE.DirectionalLight(palette.chalk, dark ? 1.1 : 1.3);
  key.position.set(24, 46, 60);
  scene.add(key);

  const tones = [palette.cyan, palette.yellow, palette.pink, palette.orange, palette.green, palette.blue];
  JOURNEY_CHAPTERS.forEach((chapter, index) => {
    const light = new THREE.PointLight(tones[index % tones.length], 3.6, 420, 0);
    light.position.set(chapter.side * 8, EXHIBIT_LIFT + 20, chapter.z - EXHIBIT_LEAD + 14);
    scene.add(light);
  });

  // ---- poeira de dados: um único campo cobre a viagem inteira (paralaxe) ----
  const DUST = 900;
  const dustPositions = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i += 1) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 230;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 130;
    dustPositions[i * 3 + 2] = -Math.random() * (JOURNEY_DEPTH + 320);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: palette.chalk,
      size: 0.9,
      map: createDotTexture(palette.chalk),
      transparent: true,
      opacity: dark ? 0.55 : 0.4,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  scene.add(dust);

  // ---- contexto das peças: o mesmo que alimenta o buraco negro ----
  const ctx: BuildContext = { palette, plates: [], params };

  // ---- prólogo: o buraco negro na origem, e os véus presos à câmera ----
  const hole = createBlackHole(ctx);
  hole.group.position.set(0, 0, HOLE_Z);
  scene.add(hole.group);
  // os véus viajam com a câmera: cobrem sempre o mesmo campo de visão
  camera.add(hole.flare, hole.void);

  // ---- estado do controlador ----
  let time = 0;
  let playing = true;
  let aspect = 1.6;
  let baseFov = 55;
  const pointerRef = { x: 0, y: 0 };
  const lookTarget = new THREE.Vector3();
  const holeTarget = new THREE.Vector3();
  const holeCenter = new THREE.Vector3(0, 0, HOLE_Z);

  // ---- o rebobininho: ao entrar na bola preta, um passo para trás ----
  // `armed` garante uma travessia por disparo: sem ele o gatilho re-dispara em
  // laço e a câmera nunca chega onde o scroll mandou.
  let armed = true;
  let passedShadow = false;
  let rewinding = false;
  let rewindClock = 0;
  let rewindAmount = 0;

  // ---- as seis peças do antigo laboratório, uma por etapa ----
  const context = {
    isPlaying: () => playing,
    pointer: () => pointerRef,
  };

  const themes: Array<{ exhibit: Exhibit; chapter: JourneyChapter }> = [
    // a ordem casa cada peça com o conteúdo da etapa
    { exhibit: createFrequencyExhibit(ctx), chapter: JOURNEY_CHAPTERS[0] },
    { exhibit: createDiceExhibit(ctx), chapter: JOURNEY_CHAPTERS[1] },
    { exhibit: createHistogramExhibit(ctx), chapter: JOURNEY_CHAPTERS[2] },
    { exhibit: createScatterExhibit(ctx), chapter: JOURNEY_CHAPTERS[3] },
    { exhibit: createCubeExhibit(ctx), chapter: JOURNEY_CHAPTERS[4] },
    { exhibit: createVennExhibit(ctx), chapter: JOURNEY_CHAPTERS[5] },
  ];

  const entrance = buildEntrance(ctx);
  const parts: ScenePart[] = [
    entrance,
    ...themes.map((theme) => buildExhibitPart(theme.exhibit, theme.chapter, context)),
  ];
  parts.forEach((part) => scene.add(part.group));

  // posiciona cada peça à frente da etapa, fora do eixo da câmera
  const place = () => {
    const narrow = aspect < 1;
    // longe o bastante do eixo para a câmera (±paralaxe) nunca entrar na peça
    const lateral = narrow ? 12 : 18;
    const scale = narrow ? 0.7 : 1;
    parts.forEach((part) => {
      part.group.position.set(part.side * lateral, EXHIBIT_LIFT, part.viewZ - EXHIBIT_LEAD);
      part.group.scale.setScalar(part.scale * scale);
    });
  };
  place();

  const advance = (dt: number, targetZ: number, pointer: { x: number; y: number }) => {
    pointerRef.x = pointer.x;
    pointerRef.y = pointer.y;
    if (playing) time += dt;
    // Com a animação pausada (prefers-reduced-motion) o tempo não anda: as
    // peças congelam, mas a câmera continua respondendo ao scroll (movimento
    // dirigido pelo usuário, não autoplay).
    const motion = playing ? dt : 0;

    // ---- prólogo: a fase vem do alvo de scroll, não de um relógio ----
    const progress = progressAt(targetZ);
    const phase = holePhase(progress);

    // ---- o rebosininho ----
    // A bola preta só existe no prólogo: fora dele o gatilho é desarmado, senão
    // pular direto para o capítulo 3 faria a câmera recuar no meio do nada.
    const inPrologue =
      progress > HOLE_CROSSING - 0.03 && progress < HOLE_REVEAL_END + 0.06;

    rewindAmount = 0;
    if (!inPrologue) {
      armed = true;
      passedShadow = false;
      rewinding = false;
    } else {
      if (camera.position.z < holeCenter.z) passedShadow = true;
      // só quando o branco da travessia já baixou: um passo para trás escondido
      // atrás da luz seria um passo para trás que ninguém vê
      if (armed && passedShadow && !rewinding && phase.flare < REWIND_FLARE_GATE) {
        rewinding = true;
        rewindClock = 0;
        armed = false;
      }
      if (rewinding) {
        rewindClock += dt;
        rewindAmount = rewindEnvelope(rewindClock);
        if (rewindClock >= REWIND_SPAN) rewinding = false;
      }
    }

    // No buraco negro a câmera desce até quase o plano do disco (a referência
    // é quase de perfil) e abre o campo de visão: a sensação de queda.
    //
    // **A coreografia é a mesma em qualquer tela.** Não há caminho alternativo
    // para o retrato: o mergulho, o close no buraco, o clarão, o rebosininho e a
    // revelação acontecem iguais para todo mundo. O único número que se adapta
    // é a *base* do campo de visão (72° no estreito, para o corredor caber); o
    // acréscimo é o mesmo, com um teto que impede a soma de passar de 78°.
    const flightY = lerp(CAMERA_HEIGHT, 3.5, phase.approach);
    const targetFov = Math.min(baseFov + phase.approach * 16, MAX_FOV);
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = damp(camera.fov, targetFov, 3, dt);
      camera.updateProjectionMatrix();
    }

    // a câmera voa por cima das peças (y ≈ 12) olhando o corredor.
    // O paralaxe do ponteiro **sai de cena com a aproximação**: no buraco negro a
    // câmera está a 3,5 unidades do plano do disco, e ±2,5 de paralaxe a leva de
    // dentro da poeira para o vazio — o enquadramento autoral viraria refém do
    // mouse. No corredor o paralaxe volta inteiro.
    const parallax = 1 - phase.approach;
    const lateralPointer = (aspect < 1 ? 4 : 5) * parallax;
    camera.position.x = damp(camera.position.x, pointer.x * lateralPointer, 2.4, dt);
    camera.position.y = damp(camera.position.y, flightY - pointer.y * 2.5 * parallax, 2.4, dt);
    // o rebobininho soma um recuo ao alvo: a câmera volta, mostra o buraco, e
    // desce de novo — o scroll continua mandando, ele só cede um instante
    camera.position.z = damp(
      camera.position.z,
      targetZ + rewindAmount * REWIND_DISTANCE,
      6.5,
      dt,
    );

// o alvo alterna entre "olhar o corredor" e "olhar o buraco", conforme a
    // fase — e durante o rebosininho o olhar volta para o buraco, que é
    // justamente o que se quer ver depois de um passo para trás
    const aim = Math.max(phase.aim, rewindAmount * 0.9);
    lookTarget.set(camera.position.x * 0.35, 0, camera.position.z - 150);
    if (aim > 0.001) {
      holeTarget.copy(holeCenter);
      lookTarget.lerp(holeTarget, aim);
    }
    camera.lookAt(lookTarget);

    // poeira: perto da câmera ela sobe devagar (paralaxe viva) e, perto do buraco
    // negro, é **puxada** por ele — a mesma gravidade que gira a poeira capturada,
    // agora sobre os pontos que já estavam na página.
    //
    // Os dois raios são independentes de propósito: no prólogo a câmera entra
    // depois de buraco, e um filtro preso à câmera pularia justamente as
    // partículas que estão sendo atraídas.
    if (motion > 0) {
      const attribute = dustGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < DUST; i += 1) {
        const z = attribute.getZ(i);

        if (Math.abs(z - camera.position.z) <= 200) {
          let y = attribute.getY(i) + 3.2 * motion;
          if (y > 70) y = -70;
          attribute.setY(i, y);
        }

        const x = attribute.getX(i);
        const dx = x;
        const dy = attribute.getY(i);
        const dz = z - HOLE_Z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance >= DUST_PULL_RADIUS || distance <= 0.001) continue;

        // cai para 1 conforme chega no buraco: nada é puxado de longe
        const nearness = 1 - distance / DUST_PULL_RADIUS;
        const pull = nearness * nearness * DUST_PULL_STRENGTH * motion;
        const ux = dx / distance;
        const uy = dy / distance;
        const uz = dz / distance;
        // em direção ao centro + um giro no plano x-z (a espiral)
        attribute.setX(i, x - ux * pull - uz * pull * 0.85);
        attribute.setY(i, dy - uy * pull);
        attribute.setZ(i, z - uz * pull + ux * pull * 0.85);
      }
      attribute.needsUpdate = true;
    }

    // a poeira do corredor "acende" junto com a revelação: o universo de dados
    // não estava lá antes, ele se condensa na queda do clarão. O piso é o que
    // fica visível no prólogo — é a poeira que o buraco puxa.
    const dustMaterial = dust.material as THREE.PointsMaterial;
    dustMaterial.opacity = (dark ? 0.55 : 0.4) * (0.3 + 0.7 * clamp(phase.reveal * 1.5, 0, 1));

    // o buraco negro só anima enquanto a câmera está perto dele
    if (Math.abs(camera.position.z - HOLE_Z) < 900) {
      hole.update(
        { t: time, dt: motion, playing, pointer: pointerRef, params: getSceneParams(), focus: 1 },
        phase,
        camera,
      );
    }

    // foco: 1 quando a câmera está no ponto de observação daquela peça.
    // Só animamos o que está perto — o resto congela (economia de CPU).
    for (const part of parts) {
      const focusDistance = Math.abs(camera.position.z - part.viewZ);
      const focus = clamp(1 - focusDistance / 240, 0, 1);
      if (Math.abs(camera.position.z - (part.viewZ - EXHIBIT_LEAD)) > 700) continue;
      part.update(time, motion, focus, phase.reveal);
    }

    scene.updateMatrixWorld();
  };

  return {
    scene,
    camera,
    advance,
    setAspect(next: number) {
      const value = clamp(next, 0.35, 4);
      const changed = Math.abs(value - aspect) > 1e-3;
      aspect = value;
      camera.aspect = aspect;
      // telas estreitas pedem um campo de visão maior para caber a cena
      baseFov = aspect < 1 ? 72 : 55;
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
      // telas estreitas aproximam as peças do eixo (senão ficam fora do quadro)
      if (changed) place();
    },
    setPlaying(next: boolean) {
      playing = next;
    },
    refreshText() {
      ctx.plates.forEach((plate) => plate.refresh());
    },
    dispose() {
      // as peças se limpam sozinhas; só a entrada e as placas precisam de ajuda
      themes.forEach((theme) => theme.exhibit.dispose());
      disposeObject(entrance.group);
      hole.dispose();
      ctx.plates.forEach((plate) => plate.dispose());
      background.dispose();
      dustGeometry.dispose();
      (dust.material as THREE.Material).dispose();
      scene.clear();
      camera.remove(hole.flare, hole.void);
    },
  };
}
