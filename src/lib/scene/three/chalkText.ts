/**
 * Texturas de giz — o "papel" de todas as placas 3D da cena.
 *
 * O Three.js não desenha fonte de mão com qualidade, então cada fórmula é
 * **desenhada num canvas 2D** (fonte `Patrick Hand`, com grão e brilho de giz) e
 * vira textura — o mesmo truque do quadro SVG (`data-science-quadro.html`), só
 * que agora o texto é colado em placas que giram no espaço.
 *
 * A marcação é a mesma do quadro (`_{sub}`, `^{sup}`), acrescida de `\\bar{x}`
 * para a média — assim `x̄` e `ȳ` saem como no caderno, sem depender de glifos
 * que a fonte pode não ter.
 *
 * O módulo é tolerante a ambientes sem canvas 2D (jsdom): nesse caso devolve uma
 * placa vazia, de tamanho previsível, para a cena ainda poder ser montada.
 */

import * as THREE from 'three';

/** Pixels de canvas por unidade de cena — define o tamanho das placas. */
export const PX_PER_UNIT = 110;

/**
 * Teto do lado de um canvas fixo. Uma placa quadrada (as faces do cubo) cresce
 * para caber o texto, mas não até virar uma textura de 4k.
 */
const FIXED_SIDE_LIMIT = 1536;

export const CHALK_FONT = "'Patrick Hand', 'Segoe Print', 'Comic Sans MS', cursive";

export interface TextStyle {
  /** texto com `_{sub}`, `^{sup}` e `\\bar{x}` */
  text: string;
  /** corpo da fonte, em px de canvas */
  size: number;
  color: string;
  /** peso da fonte (600 deixa o giz mais denso) */
  weight?: number;
  /** espaço extra antes desta linha */
  gap?: number;
}

export interface ChalkPlate {
  texture: THREE.CanvasTexture;
  /** largura em unidades de cena */
  width: number;
  /** altura em unidades de cena */
  height: number;
  /** largura / altura */
  aspect: number;
  /** Avisa quando as fontes web chegam e as medidas mudam. */
  onResize(listener: (width: number, height: number) => void): void;
  /** Redesenha (chamado quando `document.fonts.ready` resolve). */
  refresh(): void;
  dispose(): void;
}

interface PlateOptions {
  /** 'left' (padrão) ou 'center' */
  align?: 'left' | 'center';
  /** margem interna, em px de canvas */
  pad?: number;
  /** tamanho fixo do canvas (usado nas faces do cubo, para não deformar) */
  canvas?: { width: number; height: number };
}

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'sub'; value: string }
  | { kind: 'sup'; value: string }
  | { kind: 'bar'; value: string };

interface Line {
  tokens: Token[];
  size: number;
  color: string;
  weight: number;
  gap: number;
}

const SMALL = 0.66; // proporção de sub/sobrescrito

/** Quebra `texto com _{sub}, ^{sup} e \bar{x}` em tokens. */
export function tokenizeChalk(input: string): Token[] {
  const tokens: Token[] = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) {
      tokens.push({ kind: 'text', value: buffer });
      buffer = '';
    }
  };

  while (i < input.length) {
    if (input.startsWith('\\bar{', i)) {
      const end = input.indexOf('}', i + 5);
      if (end > 0) {
        flush();
        tokens.push({ kind: 'bar', value: input.slice(i + 5, end) });
        i = end + 1;
        continue;
      }
    }
    const marker = input[i];
    if ((marker === '_' || marker === '^') && input[i + 1] === '{') {
      const end = input.indexOf('}', i + 2);
      if (end > 0) {
        flush();
        tokens.push({ kind: marker === '_' ? 'sub' : 'sup', value: input.slice(i + 2, end) });
        i = end + 1;
        continue;
      }
    }
    buffer += marker;
    i += 1;
  }

  flush();
  return tokens;
}

/** Gerador determinístico (o grão do giz precisa ser o mesmo a cada redesenho). */
function mulberry(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Estimativa de largura quando não há contexto 2D (jsdom) ou fonte medida. */
function estimateWidth(text: string, size: number): number {
  return text.length * size * 0.46;
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight: number) {
  ctx.font = `${weight} ${size}px ${CHALK_FONT}`;
}

/** Largura de um texto com marcação (sub/sobrescrito contam menores). */
function richWidth(ctx: CanvasRenderingContext2D | null, tokens: Token[], size: number, weight: number): number {
  let width = 0;
  for (const token of tokens) {
    const tokenSize = token.kind === 'text' || token.kind === 'bar' ? size : size * SMALL;
    if (!ctx) {
      width += estimateWidth(token.value, tokenSize);
    } else {
      setFont(ctx, tokenSize, token.kind === 'sub' || token.kind === 'sup' ? weight - 100 : weight);
      width += ctx.measureText(token.value).width;
    }
  }
  return width;
}

/**
 * Desenha um texto com marcação a partir de `x` (baseline em `y`).
 * Devolve a largura ocupada.
 */
function drawRich(
  ctx: CanvasRenderingContext2D,
  tokens: Token[],
  x: number,
  y: number,
  size: number,
  color: string,
  weight: number,
  align: 'left' | 'center',
): number {
  const total = richWidth(ctx, tokens, size, weight);
  let cursor = align === 'center' ? x - total / 2 : x;

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(2, size * 0.16);

  for (const token of tokens) {
    if (token.kind === 'sub' || token.kind === 'sup') {
      const small = size * SMALL;
      setFont(ctx, small, Math.max(300, weight - 100));
      const dy = token.kind === 'sub' ? size * 0.3 : -size * 0.46;
      ctx.fillText(token.value, cursor, y + dy);
      cursor += ctx.measureText(token.value).width;
      continue;
    }

    setFont(ctx, size, weight);
    ctx.fillText(token.value, cursor, y);
    const width = ctx.measureText(token.value).width;
    if (token.kind === 'bar') {
      // a barra da média é desenhada à mão (não depende de glifo especial)
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.2, size * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cursor + width * 0.04, y - size * 0.74);
      ctx.lineTo(cursor + width * 0.96, y - size * 0.74);
      ctx.stroke();
      ctx.restore();
    }
    cursor += width;
  }

  ctx.shadowBlur = 0;
  return total;
}

/** Erode levemente o texto para virar giz (pontinhos de ardósia aparecendo). */
function speckle(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number) {
  const random = mulberry(seed);
  const dots = Math.round((width * height) / 900);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < dots; i += 1) {
    const r = 0.6 + random() * 1.8;
    ctx.globalAlpha = 0.1 + random() * 0.3;
    ctx.beginPath();
    ctx.arc(random() * width, random() * height, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Monta uma placa de giz: canvas → textura, com tamanho calculado pelo conteúdo
 * (ou fixo, quando `options.canvas` é passado).
 */
export function createChalkPlate(lines: TextStyle[], options: PlateOptions = {}): ChalkPlate {
  const align = options.align ?? 'left';
  const pad = options.pad ?? 14;
  const prepared: Line[] = lines.map((line) => ({
    tokens: tokenizeChalk(line.text),
    size: line.size,
    color: line.color,
    weight: line.weight ?? 600,
    gap: line.gap ?? 0.16,
  }));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const listeners: Array<(width: number, height: number) => void> = [];

  let width = 64;
  let height = 64;

  /** o que o conteúdo pediria sozinho, sem o tamanho fixo */
  const natural = () => {
    const widest = prepared.reduce(
      (max, line) => Math.max(max, richWidth(ctx, line.tokens, line.size, line.weight)),
      0,
    );
    const tall = prepared.reduce((sum, line) => sum + line.size * 1.26 + line.size * line.gap, 0);
    return {
      widest: Math.max(32, Math.ceil(widest)),
      tall: Math.max(32, Math.ceil(tall)),
    };
  };

  const measure = () => {
    const { widest, tall } = natural();
    if (options.canvas) {
      // Num canvas fixo (as faces do cubo) o texto **cresce o canvas** até caber
      // inteiro, em vez de ser cortado nas duas pontas: `drawRich` centraliza a
      // partir do meio, então qualquer estouro seria cortado dos dois lados.
      // A proporção pedida é preservada (a face do cubo é um quadrado).
      const wanted = Math.max(options.canvas.width, options.canvas.height);
      const need = Math.max(widest, tall) + pad * 2;
      const grow = Math.min(Math.max(wanted, need), FIXED_SIDE_LIMIT) / wanted;
      return {
        width: Math.ceil(options.canvas.width * grow),
        height: Math.ceil(options.canvas.height * grow),
      };
    }
    return {
      width: Math.max(32, Math.ceil(widest + pad * 2)),
      height: Math.max(32, Math.ceil(tall + pad * 2)),
    };
  };

  const paint = () => {
    const size = measure();
    canvas.width = size.width;
    canvas.height = size.height;
    width = size.width / PX_PER_UNIT;
    height = size.height / PX_PER_UNIT;
    if (!ctx) return; // jsdom: placa vazia, mas com geometria coerente

    // Só sobra estoque quando o texto é absurdo (o `canvas` tem teto); aí ele
    // encolhe em vez de vazar. No tamanho natural, `fit` é 1 e o bloco é
    // desenhado a partir de `pad`, exatamente como sempre.
    const { widest, tall } = natural();
    const fit = Math.min(1, (size.width - pad * 2) / widest, (size.height - pad * 2) / tall);

    ctx.clearRect(0, 0, size.width, size.height);
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    // o bloco é **centralizado** na vertical: antes, num canvas fixo, o texto
    // ficava colado no topo e sobrava um vão embaixo
    const block =
      prepared.reduce((sum, line) => sum + line.size * (1.26 + line.gap), 0) * fit;
    let y = (size.height - block) / 2;
    for (const line of prepared) {
      const lineSize = line.size * fit;
      y += lineSize * 1.02;
      drawRich(ctx, line.tokens, align === 'center' ? size.width / 2 : pad, y, lineSize, line.color, line.weight, align);
      y += lineSize * (0.24 + line.gap);
    }
    speckle(ctx, size.width, size.height, 7 + size.width * 31);
  };

  paint();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;

  return {
    texture,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get aspect() {
      return height > 0 ? width / height : 1;
    },
    onResize(listener) {
      listeners.push(listener);
      listener(width, height);
    },
    refresh() {
      const before = { width, height };
      paint();
      texture.needsUpdate = true;
      if (before.width !== width || before.height !== height) {
        listeners.forEach((listener) => listener(width, height));
      }
    },
    dispose() {
      texture.dispose();
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 1;
      canvas.height = 1;
      listeners.length = 0;
    },
  };
}

export interface ChalkSprite {
  sprite: THREE.Sprite;
  plate: ChalkPlate;
}

/**
 * Placa de giz flutuante (sprite): sempre de frente para a câmera, do tamanho
 * pedido em unidades de cena. `worldHeight` é a altura da placa no mundo.
 */
export function createChalkSprite(
  lines: TextStyle[],
  options: PlateOptions & { worldHeight?: number; depthTest?: boolean } = {},
): ChalkSprite {
  const plate = createChalkPlate(lines, options);
  const material = new THREE.SpriteMaterial({
    map: plate.texture,
    transparent: true,
    depthWrite: false,
    depthTest: options.depthTest ?? true,
  });
  const sprite = new THREE.Sprite(material);
  const worldHeight = options.worldHeight ?? 1;

  const applyScale = (width: number, height: number) => {
    const aspect = height > 0 ? width / height : 1;
    sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  };
  plate.onResize(applyScale);

  return { sprite, plate };
}

/**
 * Textura quadrada (faces do cubo): o texto é centrado no miolo e o quadrado
 * **cresce** se a fórmula for mais larga que `size` — cortar a conta no meio
 * seria pior do que uma placa maior.
 */
export function createFixedPlate(lines: TextStyle[], size = 512, pad = 48): ChalkPlate {
  return createChalkPlate(lines, { align: 'center', pad, canvas: { width: size, height: size } });
}

/** Disco suave usado como partícula (nuvem de dispersão, poeira de giz). */
export function createDotTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.55, `${color}b8`);
    gradient.addColorStop(1, '#00000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Gradiente vertical (fundo da cena): preto → azul-marinho, ou papel. */
export function createGradientTexture(stops: Array<[number, string]>): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Face de dado: quadrado arredondado translúcido com as pintas da face.
 * Cada face recebe sua própria textura (os dados ficam realmente "lidos").
 */
export function createDieFaceTexture(value: number, color: string, size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const inset = size * 0.06;
    const radius = size * 0.16;
    ctx.beginPath();
    ctx.moveTo(inset + radius, inset);
    ctx.arcTo(size - inset, inset, size - inset, size - inset, radius);
    ctx.arcTo(size - inset, size - inset, inset, size - inset, radius);
    ctx.arcTo(inset, size - inset, inset, inset, radius);
    ctx.arcTo(inset, inset, size - inset, inset, radius);
    ctx.closePath();
    ctx.fillStyle = `${color}22`;
    ctx.fill();
    ctx.lineWidth = size * 0.035;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.06;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const layouts: Record<number, Array<[number, number]>> = {
      1: [[0, 0]],
      2: [[-1, -1], [1, 1]],
      3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    };
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.03;
    for (const [px, py] of layouts[value] ?? []) {
      ctx.beginPath();
      ctx.arc(size / 2 + px * size * 0.22, size / 2 + py * size * 0.22, size * 0.075, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
