import { act, fireEvent, render } from '@testing-library/react';
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

  it('mostra uma questão por vez, trocando pela trilha', () => {
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
    expect(queryByRole('heading', { name: /equipamentos com defeito/i })).toBeNull();
  });

  it('"próximo" atravessa a sessão inteira, um card por vez', () => {
    const { getByRole, getByLabelText, queryByLabelText, getByText } = render(
      <ProbabilityLab />,
    );

    const next = getByRole('button', { name: 'Próxima questão' });
    const previous = getByRole('button', { name: 'Questão anterior' });

    // a trilha da ProbabilityLab é Binomial → Poisson → Normal
    expect(getByText('1 de 3')).toBeInTheDocument();
    expect(getByLabelText('p (defeito)')).toBeInTheDocument();
    // começa na primeira: só o botão de próximo existe
    expect(previous).toBeDisabled();

    // um clique, uma questão — e a anterior some, porque o painel é remontado
    fireEvent.click(next);
    expect(getByText('2 de 3')).toBeInTheDocument();
    expect(getByLabelText('λ (admissões/hora)')).toBeInTheDocument();
    expect(queryByLabelText('p (defeito)')).toBeNull();
    expect(previous).toBeEnabled();

    fireEvent.click(next);
    expect(getByText('3 de 3')).toBeInTheDocument();
    expect(getByLabelText('μ (g)')).toBeInTheDocument();
    expect(queryByLabelText('λ (admissões/hora)')).toBeNull();

    // a última não dá a volta: fechar o ciclo trocaria o assunto sem aviso
    fireEvent.click(next);
    expect(getByLabelText('μ (g)')).toBeInTheDocument();
    expect(next).toBeDisabled();

    // e voltar refaz o caminho até a primeira, onde o próximo reacte
    fireEvent.click(previous);
    expect(getByLabelText('λ (admissões/hora)')).toBeInTheDocument();
  });

  it('voltar nunca sai da sessão: os três painéis são os três itens da trilha', () => {
    const { getByRole, getByText } = render(<ProbabilityLab />);
    const previous = getByRole('button', { name: 'Questão anterior' });

    // dois passos para a frente e três para trás = a primeira questão de novo,
    // e não uma anterior que não existe
    fireEvent.click(getByRole('button', { name: 'Próxima questão' }));
    fireEvent.click(getByRole('button', { name: 'Próxima questão' }));
    fireEvent.click(previous);
    fireEvent.click(previous);
    fireEvent.click(previous);

    expect(previous).toBeDisabled();
    expect(getByText('1 de 3')).toBeInTheDocument();
  });
});
