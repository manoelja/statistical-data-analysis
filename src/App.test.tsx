import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { JOURNEY_CHAPTERS } from './lib/scene/journey';

/**
 * Verificação de integração: a página é a jornada — um canvas 3D preso ao fundo
 * e seis cards que atravessam a tela durante o percurso, cada um com o conteúdo
 * real daquela parte. O laboratório 3D em carrossel saiu.
 */
describe('App — página da jornada', () => {
  it('tem a jornada como única seção, com um card por etapa', () => {
    const { container } = render(<App />);

    expect(container.querySelector('canvas.journey__canvas')).not.toBeNull();
    expect(container.querySelectorAll('.journey__card')).toHaveLength(6);
    expect(container.querySelector('#laboratorio3d')).toBeNull();

    for (const chapter of JOURNEY_CHAPTERS) {
      expect(container.querySelector(`#${chapter.id}`), `#${chapter.id}`).not.toBeNull();
    }
  });

  it('mantém o conteúdo real e a navegação', () => {
    const { container } = render(<App />);

    const text = container.textContent ?? '';
    expect(text).toMatch(/da variabilidade aleatória à decisão/i);
    expect(text).toMatch(/SINASC/i);
    expect(container.querySelectorAll('.journey__meter button')).toHaveLength(6);

    const titles = container.querySelectorAll('h1');
    expect(titles).toHaveLength(1);
    expect(titles[0]).toHaveTextContent(/probabilidade & inferência estatística/i);
  });
});
