import { useCallback, useRef } from 'react';

/**
 * Separa o toque do card da seleção de texto — mesmo truque do `manoelja`.
 *
 * ## O problema
 *
 * O cartão da visão geral é inteiro um alvo de toque (o botão "esticado" cobre
 * os quatro lados) e dentro dele há listas, números e fórmulas. No celular,
 * qualquer toque longo começa uma **seleção de texto**: o Firefox e o Safari
 * móveis tratam o toque sustentado como "quero copiar isto", a bolha de seleção
 * sobe e o clique nunca chega ao botão. Com `user-select: none` o sintoma
 * desaparece mas se perde a cópia do texto — que num cartão de estatística é
 * justamente o que o usuário quer.
 *
 * ## O acordo
 *
 * Toque curto (o `onClick`) avança a pilha. Toque de 500ms (o
 * `onLongPress`) **não** avança nada: ele só devolve a seleção de texto,
 * ligando a classe `.selectable` enquanto o dedo está em cima. Passar de 500ms
 * já conta como "quero selecionar", então o clique é descartado e o cartão de
 * cima continua em cena.
 *
 * ## Arrastar não é tocar
 *
 * O card tem altura travada e o que não coube **rola dentro dele**. Um arrasto
 * é esse rolamento — e no mouse (e no trackpad) o `pointerup` no fim do
 * arrasto é indistinguível de um clique, então rolar o conteúdo da questão
 * virava cartão. O acordo é a **distância**: passou de `MOVE_TOLERANCE` em
 * qualquer eixo, o gesto foi de rolagem e a ação não dispara. Um toque torto de
 * dedo continua valendo como toque — 10px é mais do que o tremor de uma mão
 * parada.
 */

interface UseLongPressOptions {
  /**
   * toque que **não** virou seleção: aqui acontece a ação.
   *
   * Recebe o `PointerEvent` para quem chama poder olhar o alvo: uma pilha de
   * cartões só avança quando o toque caiu na moldura, não num slider, link ou
   * botão dentro dela.
   */
  onClick?: (event: React.PointerEvent) => void;
  /** toque sustentado: nada acontece, além de liberar a seleção */
  onLongPress?: () => void;
  /** milissegundos que separam um toque de uma seleção */
  delay?: number;
  /** seletores que recebem a classe `.selectable` durante o toque longo */
  selectableWithin?: string;
}

/** quanto o ponteiro pode andar e ainda contar como toque (px) */
const MOVE_TOLERANCE = 10;

export function useLongPress({
  onClick,
  onLongPress,
  delay = 500,
  selectableWithin = '.ov-card',
}: UseLongPressOptions = {}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const firedRef = useRef(false);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const surface = useCallback(
    (target: EventTarget | null, on: boolean) => {
      const element = (target as HTMLElement | null)?.closest?.(selectableWithin);
      if (!element) return;
      element.classList.toggle('selectable', on);
    },
    [selectableWithin],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      isLongPressRef.current = false;
      firedRef.current = false;
      originRef.current = { x: event.clientX, y: event.clientY };
      clearTimer();

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        surface(event.target, true);
        onLongPress?.();
      }, delay);
    },
    [delay, clearTimer, onLongPress, surface],
  );

  /** o gesto virou arrasto: o timer da seleção morre, porque o que está
      acontecendo agora é a rolagem do conteúdo, e ela é do navegador */
  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const origin = originRef.current;
      if (!origin) return;
      if (
        Math.abs(event.clientX - origin.x) > MOVE_TOLERANCE ||
        Math.abs(event.clientY - origin.y) > MOVE_TOLERANCE
      ) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      clearTimer();
      surface(event.target, false);

      const origin = originRef.current;
      const moved =
        origin !== null &&
        (Math.abs(event.clientX - origin.x) > MOVE_TOLERANCE ||
          Math.abs(event.clientY - origin.y) > MOVE_TOLERANCE);
      originRef.current = null;

      if (!isLongPressRef.current && !firedRef.current && !moved) {
        firedRef.current = true;
        onClick?.(event);
      }

      isLongPressRef.current = false;
    },
    [clearTimer, onClick, surface],
  );

  const handlePointerCancel = useCallback(() => {
    clearTimer();
    isLongPressRef.current = false;
    firedRef.current = false;
    originRef.current = null;
  }, [clearTimer]);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  };
}