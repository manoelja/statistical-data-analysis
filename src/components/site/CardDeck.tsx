import {
  Children,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLongPress } from '../../hooks/useLongPress';

/**
 * CardDeck — uma **pilha de cartões por sobreposição**: aparece uma carta por
 * vez e clicar nela a **transforma na próxima** (a que sai desliza e some por
 * cima enquanto a que entra sobe do fundo, as duas sobrepostas durante a
 * transição).
 *
 * ## Por que não um botão
 *
 * A moldura da jornada tinha um rodapé `Anterior · N de M · Próximo`. O botão
 * transformava um grupo de cartas (os quatro da visão geral, as fórmulas, os
 * dois painéis de resultados) em formulários de paginação: para ler a próxima
 * peça era preciso mirar um botão no rodapé, longe do conteúdo. Aqui não há
 * botão nenhum — a própria carta é o alvo.
 *
 * ## Por que a sobreposição e não o baralho
 *
 * A primeira versão empilhava as cartas com a próxima espiando por baixo (um
 * "baralho"). Ficou pesado: as bordas das cartas de trás precisavam de espaço
 * reservado no rodapé, e no celular a pilha competia com a moldura. Aqui só a
 * carta atual é montada, e a troca é um morph no próprio lugar — sem faixa
 * reservada, sem cartas empilhadas atrás. Além de mais leve, é o efeito que
 * aguenta a tela estreita sem sobrar espaço morto.
 *
 * ## O que avança (e o que não avança)
 *
 * O clique avança **a menos que** tenha caído num controle com ação própria
 * (slider, link, botão de copiar) — senão mexer num slider trocaria de carta. E
 * o toque longo não avança: fica com a seleção de texto (ver `useLongPress`),
 * porque a carta inteira é um alvo de toque.
 *
 * A volta fecha o ciclo: clicar na última volta para a primeira. Sem rodapé
 * dizendo "acabou", parar na última deixaria a sequência travada sem pista de
 * que era o fim; o próprio gesto de virar carta dá o loop.
 */

/** controles com ação própria: o clique neles não vira troca de carta */
const INTERACTIVE =
  'a[href], button, input, select, textarea, label, summary, [contenteditable="true"], [role="tab"]';

interface CardDeckProps {
  /** cada filho é uma carta, na ordem em que aparecem */
  children: ReactNode;
  /** rótulo acessível do grupo */
  label?: string;
  className?: string;
}

/**
 * O morph: a carta que sai desliza para cima e some; a que entra sobe do fundo.
 * `direction` inverte o sentido quando se volta (`previous`), para o gesto de
 * voltar não parecer o de avançar.
 */
const variants = {
  enter: (direction: number) => ({
    opacity: 0,
    scale: 0.96,
    y: direction > 0 ? 16 : -16,
  }),
  center: { opacity: 1, scale: 1, y: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    scale: 0.98,
    y: direction > 0 ? -16 : 16,
  }),
};

export function CardDeck({ children, label, className }: CardDeckProps) {
  const cards = Children.toArray(children);
  const count = cards.length;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const next = useCallback(() => {
    if (count === 0) return;
    setDirection(1);
    setIndex((current) => (current + 1) % count);
  }, [count]);

  const previous = useCallback(() => {
    if (count === 0) return;
    setDirection(-1);
    setIndex((current) => (current - 1 + count) % count);
  }, [count]);

// Toque curto vira a carta; toque longo fica com a seleção de texto. O alvo do
// toque decide: num controle com ação própria, nada acontece.
const longPress = useLongPress({
  onClick: (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.(INTERACTIVE)) return;
    next();
    // A moldura é focável, então o clique deixa o foco nela e a borda do card
    // fica acesa depois que o dedo sai da tela — o estado de teclado grudado
    // num gesto de mouse. Devolver o foco não quebra o teclado: quem chegou
    // aqui por `Tab` não passa por `pointerup`, e continua com o foco e as
    // setas funcionando.
    if (rootRef.current?.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
  },
  selectableWithin: '.deck__card',
});

  // As setas só andam a pilha quando o foco está nela mesma: com o foco num
  // slider, as setas são do slider.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== rootRef.current) return;
    const forward =
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) return;
    event.preventDefault();
    if (forward) next();
    else previous();
  };

  return (
    <div
      ref={rootRef}
      className={`deck${className ? ` ${className}` : ''}`}
      data-count={count}
      role="group"
      aria-roledescription="pilha de cartões"
      aria-label={label}
      tabIndex={count > 1 ? 0 : -1}
      onKeyDown={onKeyDown}
      {...longPress}
    >
      <div className="deck__stack">
        <AnimatePresence initial={false} custom={direction}>
          {count > 0 && (
            <motion.div
              key={index}
              className="deck__card"
              custom={direction}
              variants={variants}
              initial={reduced ? false : 'enter'}
              animate="center"
              exit={reduced ? { opacity: 0 } : 'exit'}
              transition={
                reduced ? { duration: 0 } : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }
              }
            >
              {cards[index]}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sem indicador de página: ele era um rodapé dentro de uma moldura, e
          com a moldura fora o que sobraria é uma fileira de pontinhos solta
          embaixo da peça — ruído que também competia com a régua da jornada.
          A posição continua sendo anunciada no leitor de tela, abaixo. */}
      <span className="sr-only" aria-live="polite">{`Cartão ${index + 1} de ${count}`}</span>
    </div>
  );
}
