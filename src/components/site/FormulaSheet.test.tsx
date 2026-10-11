import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormulaSheet } from './FormulaSheet';

const FIRST_EXPR = 'P(X = k) = C(n,k) · pᵏ · (1 − p)ⁿ⁻ᵏ';
const SECOND_EXPR = 'P(X = k) = e⁻λ · λᵏ / k!';

describe('FormulaSheet — botão de copiar', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  it('renderiza o botão de copiar do cartão que está em cena', () => {
    render(<FormulaSheet />);
    // a pilha mostra um cartão por vez: as cartas de trás ficam `aria-hidden`
    // e `inert`, então só o botão da carta da frente é alcançável
    expect(screen.getAllByRole('button', { name: 'Copiar fórmula' })).toHaveLength(1);
  });

  it('clicar na carta avança a pilha, e o copiar passa a ser o da nova carta', async () => {
    const { getByRole } = render(<FormulaSheet />);
    const deck = getByRole('group', { name: /formulário/i });

    // o toque curto na carta vira a próxima (o `useLongPress` usa pointer)
    fireEvent.pointerDown(deck);
    fireEvent.pointerUp(deck);

    // durante a sobreposição as duas cartas convivem; espera a de trás sair
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Copiar fórmula' })).toHaveLength(1),
    );
    const buttons = screen.getAllByRole('button', { name: 'Copiar fórmula' });
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(SECOND_EXPR);
    expect(writeText).not.toHaveBeenCalledWith(FIRST_EXPR);
  });

  it('copia a fórmula exibida no card e mostra feedback', async () => {
    render(<FormulaSheet />);
    const buttons = screen.getAllByRole('button', { name: 'Copiar fórmula' });

    fireEvent.click(buttons[0]);

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(FIRST_EXPR);

    // feedback visual: vira "Copiado!"
    expect(await screen.findByRole('button', { name: 'Copiado!' })).toBeInTheDocument();
  });


});
