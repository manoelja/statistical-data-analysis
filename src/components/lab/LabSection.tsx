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
 * do card da jornada isso não pode funcionar: o card tem rolagem própria, o
 * `IntersectionObserver` do `useActiveSection` observa a janela (não o card) e
 * as três questões empilhadas davam um card três vezes mais alto do que a
 * tela. Agora a trilha troca o painel, o card fica do tamanho de uma questão
 * e a rolagem da página volta a ser só a viagem.
 *
 * ## Uma por vez, e como se avança
 *
 * Uma questão de cada vez **já era** o comportamento desde a troca pelas abas:
 * só o painel ativo é montado, e a troupeia de questões não aparece junta. O que
 * faltava era o caminho óbvio para o painel seguinte — com a trilha estreita
 * dentro de um card de 26rem, clicar na aba certa exige mira, e nobody descobre
 * que existem outras questões. `Anterior`/`Próximo` tornam a sequência explícita
 * sem tirar o acesso direto: a trilha continua lá, só que como atalho.
 *
 * O botão é desabilitado nas pontas em vez de dar a volta: fechar o ciclo faria
 * a última questão trocar pela primeira sem que nada indicasse que a sessão
 * acabou, e o card trocaria de assunto sozinho.
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

  const step = (delta: number) => {
    const target = items[index + delta];
    if (target) setActiveId(target.id);
  };

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

          {/* A navegação da sessão: uma questão de cada vez, do começo ao fim,
              sem sair do capítulo.

              Fica **fora** do painel com `key` de propósito. Dentro dele, cada
              passo remontaria a navegação junto com a questão — e o botão que o
              usuário acabou de clicar seria destruído no mesmo instante, o que
              joga o foco do teclado para o `body` e obriga a voltar com o mouse
              a cada clique. Fora, os botões sobrevivem ao passo. */}
          {active !== undefined && (
            <div className="rail__nav">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={index === 0}
                aria-label="Questão anterior"
              >
                Anterior
              </button>
              <span className="rail__pos" aria-live="polite">
                {/* uma interpolação só: `{a} de {b}` deixa três nós de texto
                    soltos no DOM, e quem procura o contador por texto não
                    encontra. */}
                {`${index + 1} de ${items.length}`}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={index >= panels.length - 1}
                aria-label="Próxima questão"
              >
                Próximo
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}