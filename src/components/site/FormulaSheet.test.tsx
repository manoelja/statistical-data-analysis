import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormulaSheet } from './FormulaSheet';

const FIRST_EXPR = 'P(X = k) = C(n,k) · pᵏ · (1 − p)ⁿ⁻ᵏ';

describe('FormulaSheet — botão de copiar', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  it('renderiza um botão de copiar em cada card de fórmula', () => {
    render(<FormulaSheet />);
    expect(screen.getAllByRole('button', { name: 'Copiar fórmula' })).toHaveLength(8);
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

  it('não copia fórmula de outro card', async () => {
    render(<FormulaSheet />);
    const buttons = screen.getAllByRole('button', { name: 'Copiar fórmula' });

    fireEvent.click(buttons[1]);

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).not.toHaveBeenCalledWith(FIRST_EXPR);
  });
});
