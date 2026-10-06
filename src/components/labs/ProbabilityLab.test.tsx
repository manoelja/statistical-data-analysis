import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProbabilityLab } from './ProbabilityLab';
import { DEFAULT_SCENE_PARAMS, getSceneParams, resetSceneParams } from '../../lib/scene/store';

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
});
