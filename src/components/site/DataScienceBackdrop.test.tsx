import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../styles/global.css';
import { DataScienceBackdrop } from './DataScienceBackdrop';
import { resetSceneParams, setSceneParams } from '../../lib/scene/store';

describe('DataScienceBackdrop', () => {
  it('renderiza a camada de fundo .board-bg', () => {
    const { container } = render(<DataScienceBackdrop />);
    const root = container.querySelector('.board-bg');

    expect(root).toHaveAttribute('aria-hidden', 'true');
    // a regra vem do global.css (.board-bg { pointer-events: none })
    expect(getComputedStyle(root as Element).pointerEvents).toBe('none');
  });

  it('constrói a ardósia e as cenas dentro do SVG', () => {
    const { container } = render(<DataScienceBackdrop />);
    const svg = container.querySelector('svg.board-bg__svg');

    expect(svg).not.toBeNull();
    // defs + ardósia + ~30 grupos de cenas
    expect(svg!.childElementCount).toBeGreaterThan(20);
    // gradiente da ardósia e o retângulo que o usa
    expect(container.querySelector('#glowBoard')).not.toBeNull();
    expect(container.querySelector('rect[fill="url(#glowBoard)"]')).not.toBeNull();
  });

  it('troca a paleta quando o tema muda para escuro', async () => {
    const { container } = render(<DataScienceBackdrop />);
    const firstStop = () => container.querySelector('#glowBoard stop')?.getAttribute('stop-color');
    const claro = firstStop();

    await act(async () => {
      document.documentElement.classList.add('dark');
    });
    await waitFor(() => expect(firstStop()).not.toBe(claro));

    await act(async () => {
      document.documentElement.classList.remove('dark');
    });
  });

  it('espelha os parâmetros do laboratório (μ/σ) no quadro', async () => {
    setSceneParams({ mu: 3000, sigma: 600 });
    const { container } = render(<DataScienceBackdrop />);

    await waitFor(() => {
      const texto = container.querySelector('svg')?.textContent ?? '';
      expect(texto).toContain('μ = 3000 g');
      expect(texto).toContain('σ = 600 g');
    });

    resetSceneParams();
  });
});
