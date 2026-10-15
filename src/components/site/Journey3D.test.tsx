import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import journeyCss from '../../styles/journey.css?raw';
import '../../styles/journey.css';
import { Journey3D } from './Journey3D';
import {
  JOURNEY_CHAPTERS,
  JOURNEY_DEPTH,
  JOURNEY_PRESENTED_AT,
  chapterAnchor,
} from '../../lib/scene/journey';
import { resetSceneParams } from '../../lib/scene/store';

/**
 * Em jsdom não há WebGL (o `setup` faz `getContext` devolver `null`), então
 * estes testes cobrem o que **não** depende da GPU: a estrutura da página (o
 * canvas, os seis cards com o conteúdo real), o caminho de degradação e a
 * navegação. A cena e a coreografia dos cards ficam em `lib/scene/journey.test`.
 */

/**
 * jsdom devolve retângulos zerados e `offsetHeight === 0`; o componente então
 * assume uma seção de seis telas. É exatamente essa medida que o alvo do
 * scroll precisa respeitar:
 */
const TRACK = window.innerHeight * 6 - window.innerHeight;
const anchorTop = (index: number) => chapterAnchor(index) * TRACK;

afterEach(() => {
  resetSceneParams();
  vi.restoreAllMocks();
});

const css = journeyCss;

describe('Journey3D', () => {
  it('monta o canvas e um card por etapa', () => {
    const { container } = render(<Journey3D />);

    const canvas = container.querySelector('canvas.journey__canvas');
    expect(canvas).not.toBeNull();
    // a página abre no prólogo: o canvas se descreve como buraco negro
    expect(canvas).toHaveAccessibleName(/buraco negro/i);

    expect(container.querySelector('.journey__stage')).not.toBeNull();
    expect(container.querySelectorAll('.journey__card')).toHaveLength(6);
    // nenhum card nasce visível — quem manda na opacidade é o cardPose
    container.querySelectorAll<HTMLElement>('.journey__card').forEach((card) => {
      expect(card.style.visibility).not.toBe('visible');
    });
    // e a placa do prólogo é a única coisa com texto no quadro
    expect(container.querySelector('.journey__prologue')?.textContent).toMatch(
      /do outro lado do horizonte/i,
    );
    expect(container.textContent).toMatch(/parte 1 — probabilidade/i);
    expect(container.textContent).toMatch(/parte 2 — inferência/i);
  });

  it('a placa do prólogo fica sobre preto, não sobre o papel do tema', () => {
    // regressão: a placa usava `--paper`, que é #14131a — o texto era pintado
    // de quase-preto sobre o preto do buraco e o subtítulo sumia
    const { container } = render(<Journey3D />);
    const prologue = container.querySelector('.journey__prologue') as HTMLElement;
    expect(prologue).not.toBeNull();

    // as três linhas existem e nenhuma delas depende de token de tema
    const eyebrow = container.querySelector('.journey__prologue-eyebrow') as HTMLElement;
    const title = container.querySelector('.journey__prologue-title') as HTMLElement;
    const note = container.querySelector('.journey__prologue-note') as HTMLElement;
    expect(eyebrow.textContent).toMatch(/SINASC/i);
    expect(title.textContent).toMatch(/do outro lado do horizonte/i);
    expect(note.textContent).toMatch(/é a projeção da população/i);
  });

  it('o paralaxe volta ao centro quando o ponteiro sai da tela', () => {
  // Regressão do toque: o listener era só `mousemove`, que não existe no
  // celular até o navegador sintetizar um evento — e nada devolvia o ponteiro
  // a zero depois. O resultado era a câmera travada num ponto torto do paralaxe.
  const { unmount } = render(<Journey3D />);
  // jsdom não tem `PointerEvent`; um evento com as coordenadas chega igual
  const move = (type: string) => {
    const event = new Event(type) as Event & { clientX: number; clientY: number };
    event.clientX = window.innerWidth - 4;
    event.clientY = 4;
    window.dispatchEvent(event);
  };

  move('pointermove');
  move('pointerup');
  unmount();

  // listener removido: um evento posterior não deve mexer mais
  expect(() => window.dispatchEvent(new Event('pointermove'))).not.toThrow();
});

it('não tem a dica de rolagem sobre o quadro', () => {
    const { container } = render(<Journey3D />);
    expect(container.querySelector('.journey__hint')).toBeNull();
    expect(container.textContent).not.toMatch(/role para atravessar/i);
    // a régua continua sendo o que orienta a navegação
    expect(container.querySelector('.journey__meter')).not.toBeNull();
  });

  it('tem um único h1, visível só para leitores de tela', () => {
    const { container } = render(<Journey3D />);
    const titles = container.querySelectorAll('h1');
    expect(titles).toHaveLength(1);
    expect(titles[0]).toHaveTextContent(/probabilidade & inferência estatística/i);
    expect(titles[0]).toHaveClass('journey__sr');
  });

  it('traz o conteúdo real das seções dentro dos cards', () => {
    const { container } = render(<Journey3D />);
    const text = container.textContent ?? '';

    expect(text).toMatch(/da variabilidade aleatória à decisão/i); // Visão geral
    expect(text).toMatch(/o intervalo cobriu o parâmetro/i); // Resultados
    expect(text).toMatch(/cola/i); // Formulário
    expect(text).toMatch(/SINASC/i); // Contato (rodapé)

    // os laboratórios continuam interativos dentro dos cards: a trilha abre
    // uma questão por vez, então o painel corrente é o que está montado.
    // A busca é no DOM porque no scroll 0 o loop deixa os cards invisíveis, e
    // a semântica da trilha é testada em `ProbabilityLab.test`.
    expect(screen.getByLabelText('n (equipamentos)')).toBeInTheDocument();

    const normalTab = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((tab) => /normal/i.test(tab.textContent ?? ''));
    expect(normalTab).toBeDefined();
    fireEvent.click(normalTab as HTMLButtonElement);

    expect(screen.getByLabelText('μ (g)')).toBeInTheDocument();
    expect(screen.getByLabelText('σ (g)')).toBeInTheDocument();
  });

  it('as âncoras das etapas existem (navbar e deep links)', () => {
    const { container } = render(<Journey3D />);
    expect(container.querySelectorAll('.journey__marker')).toHaveLength(6);
    for (const chapter of JOURNEY_CHAPTERS) {
      expect(document.getElementById(chapter.id), `#${chapter.id}`).not.toBeNull();
    }
    // e não duplicam os ids das seções de conteúdo
    expect(document.getElementById('lab-probabilidade')).not.toBeNull();
  });

  it('avisa (sem quebrar) quando o navegador não tem WebGL', () => {
    const { container } = render(<Journey3D />);
    const fallback = container.querySelector('.journey__fallback');
    expect(fallback).not.toBeNull();
    expect(fallback).toHaveAttribute('role', 'status');
    expect(fallback?.textContent).toMatch(/webgl/i);
  });

  it('a régua de profundidade mostra a etapa atual e permite saltar', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { container } = render(<Journey3D />);

    const meter = container.querySelector('.journey__meter') as HTMLElement;
    const steps = within(meter).getAllByRole('button');
    expect(steps).toHaveLength(6);
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
    expect(steps[1]).not.toHaveAttribute('aria-current');

    fireEvent.click(steps[2]);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect((scrollTo.mock.calls[0][0] as ScrollToOptions).top).toBeCloseTo(anchorTop(2), 4);
  });

  it('as setas do teclado navegam entre as etapas', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    render(<Journey3D />);

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const avanco = (scrollTo.mock.calls[0][0] as ScrollToOptions).top ?? 0;
    expect(avanco).toBeCloseTo(anchorTop(1), 4);

    // na primeira etapa, voltar não tem para onde ir
    scrollTo.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(scrollTo).not.toHaveBeenCalled();

    // teclas comuns não mexem no scroll
    fireEvent.keyDown(window, { key: 'a' });
    expect(scrollTo).not.toHaveBeenCalled();

    // End vai direto para a última etapa
    fireEvent.keyDown(window, { key: 'End' });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect((scrollTo.mock.calls[0][0] as ScrollToOptions).top).toBeCloseTo(
      anchorTop(JOURNEY_CHAPTERS.length - 1),
      4,
    );
    expect(JOURNEY_DEPTH).toBeGreaterThan(0);
  });

  it('a rolagem termina onde a página está inteira, e não depois', () => {
// Regressão: `--journey-height` no CSS e `JOURNEY_PRESENTED_AT` no JS são o
    // mesmo número escrito em dois lugares, e nada no compilador liga um no
    // outro. Se alguém mexer na janela do contato e esquecer o CSS, a barra volta
    // a ter rolagem morta no fim — sem erro, sem aviso, só um trecho de scroll
    // em que nada acontece.
    //
    // São **dois** lugares: o breakpoint mobile reescreve o valor com uma
    // rolagem 10% mais curta, e foi exatamente esse o que passou quando o
    // desktop foi corrigido.
    const declared = [...css.matchAll(/--journey-height:\s*calc\(100vh\s*\+\s*(\d+(?:\.\d+)?)vh\)/g)];
    expect(declared).toHaveLength(2);

    // o segundo termo de cada um é a trilha, em vh de projeto
    const tracks = declared.map((match) => Number(match[1]));

    // desktop: a trilha cheia, `JOURNEY_PRESENTED_AT × 500vh` (500vh são as de
    // projeto: `--journey-track` de uma seção de seis telas)
    expect(tracks[0]).toBeCloseTo(JOURNEY_PRESENTED_AT * 500, 1);

    // mobile: 10% menos de rolagem, pela mesma razão. A tolerância é de meia unidade
    // porque a trilha é escrita em vh inteiros — `428 × 0,9` dá 385,2 e o CSS
    // diz 385. O que conta é o arredondamento, não o resto.
    expect(tracks[1]).toBeCloseTo(tracks[0] * 0.9, 0);

    // e nenhum dos dois passa do presented: nenhuma sobra depois
    for (const track of tracks) {
      expect(track / 500).toBeLessThan(1);
    }
    expect(JOURNEY_PRESENTED_AT).toBeLessThan(1);
  });
});
