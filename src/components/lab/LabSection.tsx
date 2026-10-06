import { Children, useId, useState, type ReactNode } from 'react';

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

/**
 * Layout dos laboratórios: uma **trilha de estudo** que funciona como abas —
 * uma questão por vez.
 *
 * Antes era uma trilha de navegação que rolava a página até a questão. Dentro
 * do card da jornada isso não podia funcionar: o card tem rolagem própria, o
 * `IntersectionObserver` do `useActiveSection` observa a janela (não o card) e
 * as três questões empilhadas davam um card três vezes mais alto do que a
 * tela. Agora a trilha troca o painel, o card fica do tamanho de uma questão
 * e a rolagem da página volta a ser só a viagem.
 */
export function LabSection({ id, eyebrow, title, intro, items, children }: LabSectionProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const baseId = useId();
  const panels = Children.toArray(children);
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );

  // o `key` remonta o painel ao trocar de questão: os sliders e os gráficos
  // recomeçam do estado inicial, em vez de vazar valores da questão anterior
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

          {active !== undefined && (
            <div
              key={items[index]?.id}
              id={`${baseId}-painel-${activeId}`}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${activeId}`}
              className="questions"
            >
              {active}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}