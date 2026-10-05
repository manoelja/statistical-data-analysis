import type { ReactNode } from 'react';
import { useActiveSection } from '../../hooks/useActiveSection';

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
 * Layout dos laboratórios: uma "trilha" de estudo fixa à esquerda acompanha
 * a questão em foco, enquanto as questões rolam à direita.
 */
export function LabSection({ id, eyebrow, title, intro, items, children }: LabSectionProps) {
  const ids = items.map((item) => item.id);
  const active = useActiveSection(ids);

  const goTo = (target: string) => {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="section" id={id}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{intro}</p>
        </div>

        <div className="lab__layout">
          <nav className="rail" aria-label={`Trilha de ${title}`}>
            <span className="rail__title">Trilha de estudo</span>
            {items.map((item, i) => (
              <button
                key={item.id}
                className={active === item.id ? 'active' : ''}
                onClick={() => goTo(item.id)}
              >
                <span className="rail__num">{i + 1}</span>
                {item.short}
              </button>
            ))}
          </nav>

          <div className="questions">{children}</div>
        </div>
      </div>
    </section>
  );
}
