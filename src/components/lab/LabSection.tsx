import { Children, useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLongPress } from '../../hooks/useLongPress';

export interface LabItem {
  id: string;
  short: string;
}

interface LabSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  items: LabItem[];
  children: ReactNode;
}

/** controles com ação própria: o clique neles não vira troca de questão */
const INTERACTIVE =
  'a[href], button, input, select, textarea, label, [contenteditable="true"], [role="tab"]';

/**
 * Layout dos laboratórios: uma **trilha de estudo** que funciona como abas —
 * uma questão por vez.
 *
 * ## Uma por vez, e como se avança
 *
 * Uma questão de cada vez **já era** o comportamento desde a troca pelas abas:
 * só o painel ativo é montado. O que mudou foi o caminho para a próxima — o
 * rodapé `Anterior · N de M · Próximo` saiu. Agora clicar no **próprio cartão**
 * traz a próxima questão, por sobreposição: a que sai desliza e some enquanto a
 * que entra sobe do fundo, as duas sobrepostas durante a transição. A última dá
 * a volta para a primeira, e a trilha continua lá como atalho direto.
 *
 * ## Por que só uma é montada
 *
 * Uma questão de laboratório publica os próprios parâmetros no estado da cena
 * 3D (`setSceneParams`). Montar as três juntas faria a cena mostrar uma
 * distribuição que não é a da questão em tela. Então o painel ativo é o único
 * montado — e a sobreposição é feita pelo `AnimatePresence`, que segura a
 * questão que sai só durante a animação (o efeito dela já rodou e não repete).
 *
 * O `key` remonta o painel ao trocar de questão: os sliders e os gráficos
 * recomeçam do estado inicial, em vez de vazar valores da questão anterior.
 */
export function LabSection({ id, eyebrow, title, intro, items, children }: LabSectionProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const baseId = useId();
  const panels = Children.toArray(children);
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );
  const reduced = useReducedMotion();
  const deckRef = useRef<HTMLDivElement>(null);

  /** anda `delta` questões, dando a volta na trilha */
  const step = useCallback(
    (delta: number) => {
      setActiveId((current) => {
        const from = Math.max(
          0,
          items.findIndex((item) => item.id === current),
        );
        return items[(from + delta + items.length) % items.length]?.id ?? current;
      });
    },
    [items],
  );

  // Toque curto no cartão traz a próxima questão; toque longo fica com a seleção
  // de texto. Num controle com ação própria (slider, botão), nada acontece.
  const longPress = useLongPress({
    onClick: (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(INTERACTIVE)) return;
      step(1);
      // A moldura é focável, então o clique deixa o foco nela e o card fica
      // com a borda acesa depois que o dedo sai. Quem chegou por `Tab` não
      // passa por `pointerup` e continua com o foco e as setas.
      if (deckRef.current?.contains(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
      }
    },
    selectableWithin: '.questions',
  });

  // As setas só andam a sessão quando o foco está na moldura: com o foco num
  // slider, as setas são do slider.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== deckRef.current) return;
    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(-1);
    }
  };

  const active = panels[index];

  return (
    // o id da etapa vive no marcador da jornada; aqui fica um id próprio do
    // laboratório para não duplicar a âncora da página
    <section className="section" id={`lab-${id}`}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{intro}</p>
        </div>

        <div className="lab__layout">
          <div className="rail" role="tablist" aria-label={`Trilha de ${title}`}>
            <span className="rail__title">Trilha de estudo</span>
            {items.map((item, i) => (
              <button
                key={item.id}
                id={`${baseId}-tab-${item.id}`}
                role="tab"
                type="button"
                aria-selected={item.id === activeId}
                aria-controls={`${baseId}-painel-${item.id}`}
                tabIndex={item.id === activeId ? 0 : -1}
                className={item.id === activeId ? 'active' : ''}
                onClick={() => setActiveId(item.id)}
              >
                <span className="rail__num">{i + 1}</span>
                {item.short}
              </button>
            ))}
          </div>

          <div
            ref={deckRef}
            className="questions"
            role="group"
            aria-roledescription="pilha de cartões"
            aria-label={`Questões de ${title}`}
            tabIndex={items.length > 1 ? 0 : -1}
            onKeyDown={onKeyDown}
            {...longPress}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {active !== undefined && (
                <motion.div
                  key={items[index]?.id}
                  id={`${baseId}-painel-${activeId}`}
                  role="tabpanel"
                  aria-labelledby={`${baseId}-tab-${activeId}`}
                  className="questions__card"
                  initial={reduced ? false : { opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -16 }}
                  transition={
                    reduced ? { duration: 0 } : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }
                  }
                >
                  {active}
                </motion.div>
              )}
            </AnimatePresence>

            <span className="sr-only" aria-live="polite">
              {`Questão ${index + 1} de ${items.length}`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
