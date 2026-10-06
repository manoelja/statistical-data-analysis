/**
 * Estado compartilhado do ponteiro, com inércia.
 *
 * Um único listener atende a cena inteira (câmera + partículas) e os valores
 * são suavizados por frame — a cena nunca "cola" no mouse, ela persegue o
 * alvo, que é o que dá sensação de massa à câmera.
 *
 * Portado de `educa-data/src/lib/scene/pointer.ts`.
 */

export interface PointerState {
  /** Alvo normalizado em [-1, 1] */
  targetX: number;
  targetY: number;
  /** Valor suavizado atual, também em [-1, 1] */
  x: number;
  y: number;
  /** Falso em dispositivos sem ponteiro (a câmera fica desligada) */
  supported: boolean;
}

const LERP = 0.06;

const state: PointerState = { targetX: 0, targetY: 0, x: 0, y: 0, supported: false };

let attached = false;

function handleMove(event: MouseEvent) {
  state.targetX = (event.clientX / window.innerWidth) * 2 - 1;
  state.targetY = (event.clientY / window.innerHeight) * 2 - 1;
}

function handleLeave() {
  state.targetX = 0;
  state.targetY = 0;
}

/** Liga os listeners uma única vez (idempotente). */
export function attachPointer(): void {
  if (attached || typeof window === 'undefined') return;
  attached = true;

  const hasHover =
    typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;
  state.supported = hasHover;

  if (!hasHover) return;

  window.addEventListener('mousemove', handleMove, { passive: true });
  window.addEventListener('mouseout', handleLeave);
}

/** Avança a suavização — deve ser chamado uma vez por frame. */
export function stepPointer(lerp: number = LERP): void {
  state.x += (state.targetX - state.x) * lerp;
  state.y += (state.targetY - state.y) * lerp;
}

export function getPointer(): PointerState {
  return state;
}

/** Reseta o estado compartilhado (usado nos testes). */
export function resetPointer(): void {
  state.targetX = 0;
  state.targetY = 0;
  state.x = 0;
  state.y = 0;
}
