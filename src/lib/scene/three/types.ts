/**
 * Contrato dos **elementos** da cena 3D.
 *
 * Cada peça do quadro de giz (`cubo`, `histograma`, `dispersão`, `venn`,
 * `tabela`, `dados`) vira um módulo que sabe três coisas: se animar, responder
 * ao ponteiro e se descrever para o painel lateral. O `world` só orquestra —
 * foco, câmera e luz — e não precisa conhecer o interior de ninguém.
 */

import type * as THREE from 'three';
import type { ChalkPalette } from '../chalk';
import type { SceneParams } from '../store';
import type { ChalkPlate } from './chalkText';

export interface Frame {
  /** tempo acumulado da cena (s) */
  t: number;
  /** delta do quadro (s) */
  dt: number;
  /** animação ligada (botão Play/Pause e `prefers-reduced-motion`) */
  playing: boolean;
  /** ponteiro normalizado em [-1, 1] (paralaxe) */
  pointer: { x: number; y: number };
  /** parâmetros publicados pelos laboratórios (μ, σ, λ, n, p) */
  params: SceneParams;
  /** 1 quando o elemento está em foco, 0 quando está de lado */
  focus: number;
}

export interface Readout {
  label: string;
  value: string;
}

export interface Exhibit {
  id: string;
  /** nome curto exibido no painel */
  title: string;
  /** uma linha sobre o que se vê */
  tagline: string;
  /** fórmula grande do botão "Explicar" (marcação de giz) */
  formula: string;
  /** explicação em português */
  explanation: string;
  /** posição da câmera relativa ao grupo quando em foco (mutável: dá o zoom) */
  camera: [number, number, number];
  /** altura do ponto observado, relativa ao grupo */
  lookAtY: number;
  /** o que o arrasto do ponteiro faz: girar a peça ou mexer nos parâmetros */
  drag: 'orbit' | 'params';
  group: THREE.Group;
  /** objetos que respondem ao clique/apontar */
  selectables: THREE.Object3D[];
  /** arrasto horizontal/vertical, em coordenadas normalizadas ([-1, 1]) */
  onDrag?(dx: number, dy: number): void;
  /**
   * Clique em um objeto clicável: devolve a linha de detalhe do painel.
   * Recebe a interseção inteira para quem precisa do índice do vértice
   * (`THREE.Points` da nuvem de dispersão, por exemplo).
   */
  onPick?(hit: THREE.Intersection, frame: Frame): string | null;
  /**
   * Quando o clique muda o que a peça *significa* (uma face do cubo, por
   * exemplo), ela assume o painel "Explicar" — devolvendo `null` volta ao texto
   * geral do elemento.
   */
  focusInfo?(): { title: string; formula: string; explanation: string } | null;
  /** ponteiro sobre um objeto (ou sobre nada, com `null`) */
  onHover?(hit: THREE.Intersection | null): void;
  update(frame: Frame): void;
  /** leituras do painel (a ordem importa) */
  readout(): Readout[];
  reset(): void;
  dispose(): void;
}

export interface BuildContext {
  palette: ChalkPalette;
  /** placas de giz criadas — o `world` redesenha todas quando a fonte chega */
  plates: ChalkPlate[];
  /** parâmetros iniciais (vindos do estado compartilhado) */
  params: SceneParams;
}
