import { act, fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProbabilityLab } from './ProbabilityLab';
import { DEFAULT_SCENE_PARAMS, getSceneParams, resetSceneParams, setSceneParams } from '../../lib/scene/store';

describe('ProbabilityLab → quadro animado (unificação)', () => {
  beforeEach(() => {
    resetSceneParams();
  });

  it('ao montar, publica os padrões dos sliders no estado da cena', () => {
    render(<ProbabilityLab />);
    expect(getSceneParams()).toEqual(DEFAULT_SCENE_PARAMS);
  });

  it('publica cada slider ajustado no estado da cena', () => {
    const { getByLabelText, getByRole } = render(<ProbabilityLab />);

    // a trilha é uma aba por questão: o painel troca, e o `key` remonta a
    // questão — por isso o caminho é "abrir a aba → mexer no slider"
    const openTab = (name: RegExp) => {
      const tab = getByRole('tab', { name });
      fireEvent.click(tab);
      return tab;
    };

    openTab(/normal/i);
    fireEvent.change(getByLabelText('μ (g)'), { target: { value: '3600' } });
    expect(getSceneParams().mu).toBe(3600);

    fireEvent.change(getByLabelText('σ (g)'), { target: { value: '700' } });
    expect(getSceneParams().sigma).toBe(700);

    openTab(/poisson/i);
    fireEvent.change(getByLabelText('λ (admissões/hora)'), { target: { value: '6' } });
    expect(getSceneParams().lambda).toBe(6);

    openTab(/binomial/i);
    fireEvent.change(getByLabelText('p (defeito)'), { target: { value: '0.1' } });
    expect(getSceneParams().p).toBeCloseTo(0.1, 10);
  });

  it('a cena 3D manda em μ e σ: arrastar o histograma move os sliders', () => {
    const { getByRole, getByLabelText } = render(<ProbabilityLab />);
    fireEvent.click(getByRole('tab', { name: /normal/i }));

    // exatamente o que o histograma faz ao ser arrastado (`onDrag` → store)
    act(() => setSceneParams({ mu: 2900, sigma: 320 }));

    expect((getByLabelText('μ (g)') as HTMLInputElement).value).toBe('2900');
    expect((getByLabelText('σ (g)') as HTMLInputElement).value).toBe('320');
  });

  it('um intervalo vazio (x₂ > x₃) dá 0, nunca probabilidade negativa', () => {
    const { getByRole, getByLabelText, getByText } = render(<ProbabilityLab />);
    fireEvent.click(getByRole('tab', { name: /normal/i }));

    fireEvent.change(getByLabelText('x₂ / x₃ (intervalo)'), { target: { value: '4200' } });
    fireEvent.change(getByLabelText('x₃ (limite superior)'), { target: { value: '1500' } });

    expect(getByText(/P\(x₂ < X < x₃\)/).nextElementSibling?.textContent).toBe('0,0000');
  });

  it('mostra uma questão por vez, trocando pela trilha', async () => {
    const { getByRole, getByLabelText, queryByLabelText, getByText, queryByRole } =
      render(<ProbabilityLab />);

    // abre na primeira questão
    expect(getByText(/equipamentos com defeito/i)).toBeInTheDocument();
    expect(queryByLabelText('μ (g)')).toBeNull();
    expect(queryByRole('tab', { selected: true })).toHaveAccessibleName(/binomial/i);

    fireEvent.click(getByRole('tab', { name: /normal/i }));
    expect(getByRole('heading', { name: /peso ao nascer/i })).toBeInTheDocument();
    expect(getByLabelText('μ (g)')).toBeInTheDocument();
    expect(queryByLabelText('λ (admissões/hora)')).toBeNull();
    // a questão que sai ainda fica montada durante a animação de sobreposição
    await waitForElementToBeRemoved(() =>
      queryByRole('heading', { name: /equipamentos com defeito/i }),
    );
  });

  it('clicar no cartão traz a próxima questão, uma por vez', async () => {
    const { getByRole, getByLabelText, queryByLabelText, getByText } =
      render(<ProbabilityLab />);

    const deck = getByRole('group', { name: /questões de/i });
    expect(getByText('Questão 1 de 3')).toBeInTheDocument();

    // o toque curto no cartão vira a questão (o `useLongPress` usa pointer)
    fireEvent.pointerDown(deck);
    fireEvent.pointerUp(deck);

    expect(getByLabelText('λ (admissões/hora)')).toBeInTheDocument();
    expect(getByText('Questão 2 de 3')).toBeInTheDocument();
    await waitForElementToBeRemoved(() => queryByLabelText('p (defeito)'));
  });

  it('a última questão dá a volta para a primeira', async () => {
    const { getByRole } = render(<ProbabilityLab />);

    // vai direto para a última pela trilha
    fireEvent.click(getByRole('tab', { name: /normal/i }));

    const deck = getByRole('group', { name: /questões de/i });
    fireEvent.pointerDown(deck);
    fireEvent.pointerUp(deck);

    // da Normal a próxima é a Binomial: a pilha fecha o ciclo
    expect(await screen.findByLabelText('p (defeito)')).toBeInTheDocument();
  });

  it('a resolução abre **sobre** o conteúdo, com fechamento próprio', () => {
    const { getByRole, getByLabelText, queryByLabelText } = render(<ProbabilityLab />);

    const toggle = getByRole('button', { name: /ver resolução passo a passo/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    const panel = getByLabelText('Resolução passo a passo');
    // a camada mora **dentro do corpo do cartão**: é contra ele que o
    // `.reveal__panel` se posiciona, para cobrir o conteúdo em vez de
    // empurrá-lo (o `margin-top`/`fio` que ele tinha antes saíram)
    expect(panel.closest('.qcard__body')).not.toBeNull();
    expect(panel).toHaveTextContent('0,000008');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(getByRole('button', { name: /fechar resolução/i }));
    expect(queryByLabelText('Resolução passo a passo')).toBeNull();
  });

  it('arrastar o conteúdo não vira questão: é a rolagem do que não coube', () => {
    const { getByRole, getByText } = render(<ProbabilityLab />);

    const deck = getByRole('group', { name: /questões de/i });
    // o card tem altura travada: nas questões altas o conteúdo é maior que a
    // janela e rola dentro dela. Um arrasto é essa rolagem — se contasse como
    // toque, não haveria como ler o resto da questão.
    fireEvent.pointerDown(deck, { clientX: 100, clientY: 300 });
    fireEvent.pointerMove(deck, { clientX: 102, clientY: 240 });
    fireEvent.pointerUp(deck, { clientX: 102, clientY: 240 });

    expect(getByText('Questão 1 de 3')).toBeInTheDocument();
    expect(getByText(/equipamentos com defeito/i)).toBeInTheDocument();
  });

  it('um toque torto de dedo ainda vira questão', () => {
    const { getByRole, getByText } = render(<ProbabilityLab />);

    const deck = getByRole('group', { name: /questões de/i });
    // 4px de tremor é tremor, não arrasto: a tolerância existe para o dedo
    fireEvent.pointerDown(deck, { clientX: 100, clientY: 300 });
    fireEvent.pointerMove(deck, { clientX: 102, clientY: 296 });
    fireEvent.pointerUp(deck, { clientX: 102, clientY: 296 });

    expect(getByText('Questão 2 de 3')).toBeInTheDocument();
  });
});
