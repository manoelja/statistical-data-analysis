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
 * Cada etapa tem também o seu **elemento 3D** — os do antigo laboratório
 * (tabela de frequências, dados, histograma, nuvem de dispersão e cubo de
 * fórmulas), reaproveitados como cenas do corredor. O contato não tem peça de
 * laboratório: a dele é a nebulosa, plantada no fundo do corredor.
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
import { createWhiteHole, WHITE_HOLE_STOP } from './three/whitehole';
import { createCubeExhibit } from './three/cube';
import { createDiceExhibit } from './three/dice';
import { createFrequencyExhibit } from './three/frequency';
import { createHistogramExhibit } from './three/histogram';
import { createScatterExhibit } from './three/scatter';
import { createNebula } from './three/nebula';
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

/**
 * Centro do **buraco branco**, no fim da viagem: a mesma profundidade onde a
 * câmera termina (`depthAt(1)`).
 *
 * A câmera **não pode parar dentro dele** — ou o núcleo tem de ser marcado com
 * `letCameraPass` (como a sombra do buraco negro), porque o teste que varre a
 * viagem inteira acusa a câmera de atravessar peça sólida.
 */
export const WHITE_HOLE_Z = -JOURNEY_DEPTH;

/**
 * Duração do fade-in/out dos cards, em fração do progresso total.
 *
 * `0,03` e não `0,04` por causa do card de contato: ele entra logo depois do
 * estouro do buraco branco e precisa estar **clickável antes** de a nebulosa
 * acabar de acender (ver `JOURNEY_CHAPTERS`), senão sobra rolagem entre "a
 * nebulosa está inteira" e "os botões existem".
 */
export const CARD_FADE = 0.03;

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

export type CardSide = 'left' | 'right' | 'center' | 'bottom';

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
 * as âncoras ficam em 0,28 · 0,41 · 0,55 · 0,68 · 0,76 · 0,96 — quase
 * uniformes, porque o espaçamento do corredor também é. O `enter` da primeira
 * etapa é 0,225, depois de `HOLE_REVEAL_END`: o capítulo 1 só aparece quando o
 * "outro universo" dos dados já está formado.
 *
 * **O fim tem duas viradas.** Depois do capítulo 5 vem o *epílogo* (o buraco
 * branco, `EPILOGUE_START` a 0,80) e só então o capítulo de contato, que é o
 * destino: ele fecha em 1 e nunca sai. A nebulosa que dá o nome à última sala
 * nasce **no mesmo lugar onde o buraco branco estava**, quando o branco do
 * estouro baixa — a peça não chega de fora, ela é o que sobrou da explosão.
 */
export const JOURNEY_CHAPTERS: JourneyChapter[] = [
  {
    id: 'visao',
    title: 'Visão Geral',
    tagline: 'Da teoria dos dados à prática',
    z: -390,
    enter: 0.225,
    exit: 0.32,
    side: 1,
    cardSide: 'left',
  },
  {
    id: 'probabilidade',
    title: 'Parte 1 — Probabilidade',
    tagline: 'Binomial, Poisson e Normal',
    z: -709,
    enter: 0.335,
    exit: 0.43,
    side: -1,
    cardSide: 'right',
  },
  {
    id: 'inferencia',
    title: 'Parte 2 — Inferência',
    tagline: 'Intervalos de confiança e testes de hipótese',
    z: -1028,
    enter: 0.445,
    exit: 0.54,
    side: 1,
    cardSide: 'left',
  },
  {
    id: 'resultados',
    title: 'Resultados',
    tagline: 'O intervalo cobriu o parâmetro?',
    z: -1347,
    enter: 0.555,
    exit: 0.65,
    side: -1,
    cardSide: 'right',
  },
  {
    id: 'formulario',
    title: 'Formulário',
    tagline: 'A "cola" que resolve tudo',
    z: -1666,
    enter: 0.665,
    exit: 0.76,
    side: 1,
    cardSide: 'left',
  },
  {
    id: 'contato',
    title: 'Contato',
    tagline: 'SINASC/DataSUS · R 4.6.0',
    z: -2400,
    // Sobe logo depois do estouro: o branco já cobre ~97% do quadro quando o
    // card começa a aparecer, então ele **materializa** conforme o flash
    // clareia, em vez de deslizar por cima do disco de ejeção. E como a
    // nebulosa precisa de 0,016 de progresso depois para acender inteiro, o
    // card entra em 0,826 para ficar clickável (`opacity > 0.4`) **antes**
    // dela — rolagem extra para achá-los: zero.
    enter: 0.826,
    exit: 1,
    side: 1,
    cardSide: 'bottom',
  },
];

/**
 * Progresso em que a página está **inteiramente apresentada**: o instante em que
 * o último card termina de entrar.
 *
 * ## Por que isto existe
 *
 * A janela do último capítulo vai até `exit = 1`, mas o card fica opaco
 * `CARD_FADE` depois de `enter` — e **depois disso nada mais acontece**: a câmera
 * está travada no epílogo, a nebulosa já acendeu e o card não se move. Com
 * `exit = 1` como fim do scroll, isso deixava **72vh de rolagem morta**: dava para
 * arrastar a barra até o fim e a nebulosa não mudava em nada.
 *
 * O número é derivado, não escolhido: se alguém mexer na janela do contato,
 * o fim do scroll acompanha. A barra de rolagem é montada para terminar aqui —
 * ver `--journey-height` em `journey.css` e `scrollProgress` em `Journey3D`.
 */
export const JOURNEY_PRESENTED_AT =
  JOURNEY_CHAPTERS[JOURNEY_CHAPTERS.length - 1].enter + CARD_FADE;

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

/* ============================================================
   Epílogo: o buraco branco
   ============================================================ */

/** Onde a página deixa de ser capítulo e vira epílogo: a saída da etapa **antes**
 * do contato. O contato é o destino — ele vem depois do buraco branco.
 */
export const EPILOGUE_START = JOURNEY_CHAPTERS[JOURNEY_CHAPTERS.length - 2].exit;

/**
 * Para onde a câmera **olha** durante o epílogo (unidades de cena).
 *
 * Negativo de propósito: a câmera fica em y ≈ 6 e a peça em y = 0, então mirar
 * abaixo **ergue** a peça na tela sem movê-la no mundo. É o que tira o olho de
 * trás da faixa de contato — e o que mantém a nebulosa a zero distância do buraco
 * branco, que é onde ela tem que estar. A conta dá ~20% acima do centro do
 * quadro a 100 unidades, que é o céu que sobra acima do card.
 */
const EPILOGUE_AIM_Y = -21;

/**
 * As três pernas do epílogo, em progresso. Juntas, elas fecham em
 * `JOURNEY_CHAPTERS[last].enter`: depois disso é o capítulo de contato.
 */
const GATHER = 0.03;
const BURST = 0.04;
const AFTERGLOW = 0.035;

export interface EmitPhase {
  /** a poeira do corredor converge para o ponto final: 0 → 1 */
  gather: number;
  /** o clarão branco toma o quadro: 0 → 1 */
  burst: number;
  /** o branco baixa de novo e a nebulosa nasce no lugar do buraco: 0 → 1 */
  afterglow: number;
  /** para onde a câmera olha (o corredor × o buraco branco) */
  aim: number;
}

/**
 * Coreografia do epílogo, em função do scroll — a mesma forma de `holePhase`.
 *
 * Um buraco branco é o buraco negro com o tempo invertido: o mesmo disco de
 * partículas, com o raio **fechando** em vez de abrindo. aqui mora só o roteiro
 * (função pura, testável, com o mesmo cuidado do prólogo: `reduced-motion`
 * precisa do mesmo caminho). O desenho vem na etapa seguinte, em
 * `three/whitehole.ts`.
 *
 * O olhar vira para o buraco branco enquanto a poeira converge e **volta** para
 * o corredor no começo do estouro — é o branco que cobre a virada, como o
 * clarão do prólogo escondia a volta da câmera.
 */
export function emitPhase(progress: number): EmitPhase {
  const value = clamp(progress, 0, 1);
  const start = EPILOGUE_START;
  if (value <= start) return { gather: 0, burst: 0, afterglow: 0, aim: 0 };

  const gatherEnd = start + GATHER;
  const burstEnd = gatherEnd + BURST;
  const gather = ease(clamp((value - start) / GATHER, 0, 1));
  const burst = ease(clamp((value - gatherEnd) / BURST, 0, 1));
  const afterglow = ease(clamp((value - burstEnd) / AFTERGLOW, 0, 1));

  return { gather, burst, afterglow, aim: gather * (1 - burst) * (1 - afterglow) };
}

/**
 * Opacidade da placa do epílogo. É o espelho de `prologueOpacity`: a frase
 * entra com a convergência (quando o buraco branco ainda está no quadro) e sai
 * com o estouro — o branco é que fecha a página, e texto sobre branco não se lê.
 *
 * O coeficiente do estouro é **maior** que o da entrada (2,5 contra 2,4) de
 * propósito: com iguais, `2,4 − 2,2` deixa a frase em 20% de opacidade exatamente
 * no fim do scroll, ou seja, um fantasma sobre o branco.
 */
export function epilogueOpacity(progress: number): number {
  const { gather, burst, afterglow } = emitPhase(progress);
  // o afterglow também derruba a frase: a nebulosa já está acendendo no mesmo
  // quadro, e duas legendas competindo é pior que uma só
  return clamp(gather * 2.4 - burst * 2.5 - afterglow * 1.2, 0, 1);
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
  /** deslocamento em % (no eixo X, ou no Y quando o card é `bottom`) */
  shift: number;
  /** escala */
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

  // `center` não desliza (é um painel no meio); `bottom` desliza no eixo Y (o CSS
  // troca o eixo do transform), então o sinal é invertido para ele subir de baixo
  const lateral =
    chapter.cardSide === 'center' ? 0 : chapter.cardSide === 'bottom' ? -1 : chapter.cardSide === 'left' ? -1 : 1;
  const eased = phase * phase * (3 - 2 * Math.abs(phase));

  // A escala acompanha o **fade**, e não a fase.
  //
  // Escala fracionária obriga o navegador a rasterizar o card inteiro — texto
  // incluído — numa escala não inteira, e a letra sai macia. Isso não valia só
  // para o card que estava entrando ou saindo: `eased` é zero **no meio** da
  // janela e cresce até 1 nas pontas, de modo que a escala passava de 1,000 a
  // 1,020 durante toda a transição — e era a letra de todos os cards da
  // jornada que aparecia suavizada o tempo todo.
  //
  // Amarrando a escala à opacidade, o card cresce enquanto aparece e encolhe
  // enquanto some, e no estado em que ele se lê — opacidade 1 — a escala é
  // exatamente 1. O texto nítido.
  const fade = 1 - clamp(opacity, 0, 1);

  return {
    opacity: clamp(opacity, 0, 1),
    shift: lateral * eased * 26,
    scale: 1 + Math.abs(eased) * 0.02 * fade,
  };
}

/**
 * Onde a câmera chega ao centro da etapa `index` — em **fração da rolagem**, não
 * em progresso.
 *
 * A conversão por `JOURNEY_PRESENTED_AT` é o que amarra a âncora ao fim real do
 * scroll: como o scroll vai de 0 a `JOURNEY_PRESENTED_AT` (e não até 1), um
 * progresso puro apontaria para um lugar que a página não tem mais.
 *
 * O `clamp` no topo não é defensivo, é necessário: a etapa de contato fica a
 * `0,966` de progresso, que em fração de scroll dá `1,13` — ou seja, além do
 * fim. A âncora de uma etapa tem de ser um lugar alcançável, e o certo para o
 * contato é o fim da rolagem, que é exatamente onde ele está inteiro.
 */
export function chapterAnchor(index: number): number {
  const chapter = JOURNEY_CHAPTERS[clamp(Math.round(index), 0, JOURNEY_CHAPTERS.length - 1)];
  return clamp(progressAt(chapter.z) / JOURNEY_PRESENTED_AT, 0, 1);
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
   * Y próprio da peça. Só a nebulosa usa, e é `0` de propósito: ela não é uma
   * peça do corredor, é a **mesma** peça do buraco branco, no mesmo milímetro —
   * a substituindo. Quem a ergue na tela é o olhar da câmera, não ela.
   */
  lift?: number;
  /**
   * `reveal` é a fase da revelação do prólogo: só a entrada o usa, para acender
   * o título junto com a poeira. `emit` é o *afterglow* do epílogo: só a
   * nebulosa o usa, para nascer quando o branco do buraco branco baixa. As
   * peças do corredor ignoram os dois.
   */
  update(t: number, dt: number, focus: number, reveal: number, emit?: number): void;
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

/* ============================================================
   Entrada: texto gigante + símbolos matemáticos
   ============================================================ */

/**
 * Altura da placa do título. Lado a lado o bloco ficou bem mais largo, então a
 * letra cede um pouco para a linha caber no quadro sem virar uma parede.
 */
const TITLE_HEIGHT = 12;

/** Folga entre as duas palavras do título, em unidades de cena. */
const TITLE_GAP = 2;

/** Onde o título paira, à frente do observador da primeira etapa. */
const TITLE_Y = 20;
const TITLE_Z = 40;

function buildEntrance(ctx: BuildContext): ScenePart {
  const group = new THREE.Group();
  const palette = ctx.palette;

  // "DATA SCIENCE" numa **linha só**, com as duas cores do título: cada palavra
  // é uma placa, e as duas se encostam pela largura **já escalada** da placa —
  // quando a fonte web chega e as placas mudam de tamanho, elas se realinham.
  const words = [
    { text: 'DATA', color: palette.chalk },
    { text: 'SCIENCE', color: palette.cyan },
  ].map((word) => {
    const made = createChalkSprite(
      [{ text: word.text, size: 150, color: word.color, gap: 0 }],
      { worldHeight: TITLE_HEIGHT, align: 'left' },
    );
    ctx.plates.push(made.plate);
    group.add(made.sprite);
    return made;
  });

  const lineUp = () => {
    // `scale.x` e não a largura da placa: a placa nasce em pixels de canvas e o
    // sprite é escalado para `worldHeight` — a escala é quem manda na tela.
    const widths = words.map((word) => word.sprite.scale.x);
    const total = widths.reduce((sum, width) => sum + width, 0) + TITLE_GAP;
    let cursor = -total / 2;
    words.forEach((word, index) => {
      word.sprite.position.set(cursor + widths[index] / 2, TITLE_Y, TITLE_Z);
      cursor += widths[index] + TITLE_GAP;
    });
  };
  // a placa avisa quem mudou de tamanho **depois** de se escalar
  words.forEach((word) => word.plate.onResize(lineUp));
  lineUp();

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
      words.forEach((word) => {
        word.sprite.material.opacity = ignite * (0.86 + 0.14 * Math.abs(drift(t * 0.4, 3)));
      });
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

  // A cena é o espaço da jornada: vazio escuro do começo ao fim.
  const background = createGradientTexture([
    [0, '#05070f'],
    [0.45, '#0a1226'],
    [1, '#04050a'],
  ]);
  scene.background = background;
  // FogExp2: o que está longe perde contraste e "afunda" na profundidade
  scene.fog = new THREE.FogExp2(new THREE.Color(palette.board1), 0.0034);

  // O `far` precisa alcançar as estrelas de fundo do prólogo (esfera de 1100
  // unidades): com 620 o céu acabava num arco visível bem antes do fim da
  // viagem. O `near` continua apertado porque quem decide a precisão é ele.
  const camera = new THREE.PerspectiveCamera(55, 1.6, 0.1, 1400);
  camera.position.set(0, CAMERA_HEIGHT, JOURNEY_LEAD);

  // ---- luzes: ambiente + hemisférica + direcional + uma por etapa ----
  scene.add(new THREE.AmbientLight(palette.chalk, 0.6));
  scene.add(new THREE.HemisphereLight(palette.cyan, palette.board1, 0.5));

  const key = new THREE.DirectionalLight(palette.chalk, 1.1);
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
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  scene.add(dust);

  // A poeira do corredor tem duas vidas: no prólogo ela **acende** com o disco
  // virando o universo de dados; no epílogo ela começa a **convergir** para o
  // buraco branco. As duas cores são pré-calculadas: `lerpColors` não aloca, e
  // este laço roda a 60 fps.
  const dustCold = new THREE.Color(palette.chalk);
  const dustHot = new THREE.Color('#ffffff');

  // ---- contexto das peças: o mesmo que alimenta o buraco negro ----
  const ctx: BuildContext = { palette, plates: [], params };

  // ---- prólogo: o buraco negro na origem, e os véus presos à câmera ----
  const hole = createBlackHole(ctx);
  hole.group.position.set(0, 0, HOLE_Z);
  scene.add(hole.group);
  // os véus viajam com a câmera: cobrem sempre o mesmo campo de visão
  camera.add(hole.flare, hole.void);

  // ---- epílogo: o buraco branco no fundo do corredor ----
  const white = createWhiteHole(ctx);
  white.group.position.set(0, 0, WHITE_HOLE_Z);
  scene.add(white.group);
  camera.add(white.flash);

  // ---- estado do controlador ----
  let time = 0;
  let playing = true;
  let aspect = 1.6;
  let baseFov = 55;
  const pointerRef = { x: 0, y: 0 };
  const lookTarget = new THREE.Vector3();
  const holeTarget = new THREE.Vector3();
  const whiteTarget = new THREE.Vector3();
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
    // (o contato não tem peça de laboratório: a peça dele é a nebulosa, mais
    // abaixo — o Venn saiu de cena)
  ];

  // A nebulosa não é um `Exhibit` (não tem clique nem leitura): é a peça de
  // chegada, plantada **no eixo** e no mesmo ponto onde o buraco branco estava,
  // de onde ela acende quando o branco do estouro baixa.
  const nebula = createNebula(ctx);

  const entrance = buildEntrance(ctx);
  const parts: ScenePart[] = [
    entrance,
    ...themes.map((theme) => buildExhibitPart(theme.exhibit, theme.chapter, context)),
    // A nebulosa entra na lista como peça do contato (mesmo `place()`, mesmo
    // `focus`, mesmo descarte), mas plantada no **z do buraco branco**: é
    // literalmente o mesmo ponto do corredor, com a mesma peça no lugar.
    // `viewZ` é o ponto de observação da câmera; a peça fica `EXHIBIT_LEAD`
    // à frente dele, e por isso o `+ EXHIBIT_LEAD` abaixo.
    {
      group: nebula.group,
      viewZ: WHITE_HOLE_Z + EXHIBIT_LEAD,
      side: 0,
      scale: 1,
      // zero distância do buraco branco: mesma posição, peça trocada
      lift: 0,
      update: (t, dt, focus, _reveal, emit) => nebula.update(t, dt, focus, emit ?? 0),
    },
  ];
  // A câmera **não atravessa** a nebulosa, e não por acaso: `WHITE_HOLE_STOP`
  // (a trava do epílogo) já a deixa `WHITE_HOLE_STOP` unidades antes do buraco
  // branco — que agora é onde a nebulosa acende. O usuário chega, vê o olho e
  // fica parado na frente dele: atravessar um olho seria perder justamente o
  // ponto de vista que a peça construiu.
  nebula.group.userData.letCameraPass = false;
  parts.forEach((part) => scene.add(part.group));

  // posiciona cada peça à frente da etapa, fora do eixo da câmera
  const place = () => {
    const narrow = aspect < 1;
    // longe o bastante do eixo para a câmera (±paralaxe) nunca entrar na peça
    const lateral = narrow ? 12 : 18;
    const scale = narrow ? 0.7 : 1;
    parts.forEach((part) => {
      part.group.position.set(
        part.side * lateral,
        part.lift ?? EXHIBIT_LIFT,
        part.viewZ - EXHIBIT_LEAD,
      );
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
    // ---- epílogo: a mesma coisa, do outro lado ----
    const emit = emitPhase(progress);
    // `gather` satura em 1 e **fica**: a partir daqui a página é o buraco branco
    // e, depois, a nebulosa. Tudo o que é "parar no lugar" lê esta flag.
    const inEpilogue = emit.gather > 0;

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
    // é quase de perfil) e abre o campo de visão: a sensação de queda. No
    // epílogo ela desce um pouco e abre mais no estouro — o buraco branco é
    // grande, e o quadro tem de caber nele.
    //
    // **A coreografia é a mesma em qualquer tela.** Não há caminho alternativo
    // para o retrato: o mergulho, o close no buraco, o clarão, o rebosininho e a
    // revelação acontecem iguais para todo mundo. O único número que se adapta
    // é a *base* do campo de visão (72° no estreito, para o corredor caber); o
    // acréscimo é o mesmo, com um teto que impede a soma de passar de 78°.
    const flightY = lerp(lerp(CAMERA_HEIGHT, 3.5, phase.approach), 6, emit.gather);
    const targetFov = Math.min(baseFov + phase.approach * 16 + emit.burst * 12, MAX_FOV);
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = damp(camera.fov, targetFov, 3, dt);
      camera.updateProjectionMatrix();
    }

    // a câmera voa por cima das peças (y ≈ 12) olhando o corredor.
    // O paralaxe do ponteiro **sai de cena com a aproximação**: no buraco negro a
    // câmera está a 3,5 unidades do plano do disco, e ±2,5 de paralaxe a leva de
    // dentro da poeira para o vazio — o enquadramento autoral viraria refém do
    // mouse. No corredor o paralaxe volta inteiro.
    //
    // E vale o mesmo para a **nebulosa**: lá o mouse não tem nada para arrastar, e
    // puxar a câmera de lado a 62 unidades (4,6° de ângulo) tirava o olho do
    // centro do quadro. Com a câmera travada em x e y o enquadramento fica
    // autoral: o que se move ali é o gás, não o ponto de vista.
    const parallax = 1 - Math.max(phase.approach, inEpilogue ? 1 : 0);
    const lateralPointer = (aspect < 1 ? 4 : 5) * parallax;
    camera.position.x = damp(camera.position.x, pointer.x * lateralPointer, 2.4, dt);
    camera.position.y = damp(camera.position.y, flightY - pointer.y * 2.5 * parallax, 2.4, dt);
    // o rebobininho soma um recuo ao alvo: a câmera volta, mostra o buraco, e
    // desce de novo — o scroll continua mandando, ele só cede um instante
    // No epílogo a perseguição **vira**: em vez de seguir o scroll, a câmera vai
    // direto para a parada do buraco branco e **fica** lá.
    //
    // Antes era `Math.max(targetZ, parada)`, que só segurava a câmera quando o
    // scroll já tinha passado do ponto — e como o epílogo começa em 0,76 (com a
    // câmera ainda em -1804), o branco do buraco baixava com ela a ~490 unidades
    // da nebulosa: o usuário tinha de rolar para chegar perto. Indo direto, ela
    // já está parada de frente para a nebulosa no instante em que ela acende, e o
    // resto do scroll só traz o card de contato por cima.
    const chase = inEpilogue ? WHITE_HOLE_Z + WHITE_HOLE_STOP : targetZ;
    camera.position.z = damp(
      camera.position.z,
      chase + rewindAmount * REWIND_DISTANCE,
      // a chegada é mais rápida que a perseguição normal: é uma chegada, não um
      // acompanhamento
      inEpilogue ? 9 : 6.5,
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
    // No epílogo o mesmo gesto aponta para o buraco branco, e volta ao corredor
    // quando o branco do estouro cobre a virada.
    if (emit.aim > 0.001) {
      whiteTarget.set(0, 0, WHITE_HOLE_Z);
      lookTarget.lerp(whiteTarget, emit.aim);
    }
    // No afterglow a nebulosa já está **no mesmo ponto** do buraco branco — ela
    // não se move um milímetro. O que sobe é o **olhar**: a faixa de contato
    // ocupa o rodapé, e sem esta inclinação o olho ficaria atrás dela. Mirar
    // abaixo (e não levantar a peça) é o que mantém as duas no mesmo lugar.
    if (emit.afterglow > 0.001) {
      whiteTarget.set(0, EPILOGUE_AIM_Y, WHITE_HOLE_Z);
      lookTarget.lerp(whiteTarget, emit.afterglow);
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
    // fica visível no prólogo — é a poeira que o buraco puxa. No epílogo ela
    // brilha de novo, agora para convergir no buraco branco.
    const dustMaterial = dust.material as THREE.PointsMaterial;
    const glow = 0.3 + 0.7 * clamp(phase.reveal * 1.5, 0, 1);
    dustMaterial.opacity = 0.55 * glow * (1 + emit.gather * 0.7);
    dustMaterial.color.lerpColors(dustCold, dustHot, emit.gather * 0.7);

    // o buraco negro só anima enquanto a câmera está perto dele
    if (Math.abs(camera.position.z - HOLE_Z) < 900) {
      hole.update(
        { t: time, dt: motion, playing, pointer: pointerRef, params: getSceneParams(), focus: 1 },
        phase,
        camera,
      );
    }

    // o buraco branco é o espelho: só existe no fim do corredor, e a câmera só
    // chega perto no epílogo — antes disso o disco dele está lá, apagado
    if (camera.position.z > WHITE_HOLE_Z - 900) {
      white.update(
        { t: time, dt: motion, playing, pointer: pointerRef, params: getSceneParams(), focus: 1 },
        emit,
        camera,
      );
    }

    // foco: 1 quando a câmera está no ponto de observação daquela peça.
    // Só animamos o que está perto — o resto congela (economia de CPU).
    for (const part of parts) {
      const focusDistance = Math.abs(camera.position.z - part.viewZ);
      const focus = clamp(1 - focusDistance / 240, 0, 1);
      if (Math.abs(camera.position.z - (part.viewZ - EXHIBIT_LEAD)) > 700) continue;
      // A nebulosa acende **mais rápido** que o `afterglow`: o pedido é que ela
      // já esteja gigante quando o branco baixa, sem o usuário ter de rolar mais.
      // O `×2,2` gasta só ~8% da perna (uns 4vh de scroll) para ir de 0 a 1.
      part.update(time, motion, focus, phase.reveal, clamp(emit.afterglow * 2.2, 0, 1));
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
      white.dispose();
      nebula.dispose();
      ctx.plates.forEach((plate) => plate.dispose());
      background.dispose();
      dustGeometry.dispose();
      (dust.material as THREE.Material).dispose();
      scene.clear();
      camera.remove(hole.flare, hole.void, white.flash);
    },
  };
}
