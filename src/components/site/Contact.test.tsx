import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../styles/global.css';
import { Contact } from './Contact';

/**
 * O contato é a saída da página: três links externos, o portfólio com a marca do
 * projeto e a caixa "sobre" que abre **abaixo** do botão.
 *
 * Os links reais estão em `LINKS` — o que este teste garante é a estrutura e a
 * acessibilidade do gatilho, não os URLs.
 *
 * A sala é **só os botões**: com a moldura do card fora, o texto de abertura
 * viraria uma frase solta flutuando sobre a nebulosa, sem superfície atrás.
 */
describe('Contact', () => {
  it('monta os quatro botões de saída', () => {
    const { container, getByRole, queryByText } = render(<Contact />);

    expect(getByRole('link', { name: /github/i })).toBeInTheDocument();
    expect(getByRole('link', { name: /linkedin/i })).toBeInTheDocument();
    expect(getByRole('link', { name: /portf/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /sobre o desenvolvedor/i })).toBeInTheDocument();

    // e nenhum texto de acompanhamento: os botões são o conteúdo inteiro
    expect(container.querySelector('.contact__lead')).toBeNull();
    expect(queryByText(/nébulosa acende/i)).not.toBeInTheDocument();
  });

  it('os três links externos abrem em aba nova com segurança', () => {
    const { getAllByRole } = render(<Contact />);
    getAllByRole('link').forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      // `noopener` é obrigatório em `target="_blank"` (senão a aba nova sequestra
      // a referência da janela)
      expect(link.getAttribute('rel')).toContain('noopener');
    });
  });

  it('o portfólio usa a marca do projeto (o raio em public/)', () => {
    const { getByRole } = render(<Contact />);
    const icon = getByRole('link', { name: /portf/i }).querySelector('img');
    expect(icon).toHaveAttribute('src', '/manoelja.svg');
    // decorativo: o nome já está no texto do botão
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('a caixa "sobre" abre e fecha abaixo do botão', () => {
    const { getByRole, queryByRole } = render(<Contact />);
    const trigger = getByRole('button', { name: /sobre o desenvolvedor/i });

    // fechado: sem caixa e com o estado acessível coerente
    expect(queryByRole('button', { name: /sobre o desenvolvedor/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(document.getElementById('contact-sobre')).toBeNull();

    fireEvent.click(trigger);
    const box = document.getElementById('contact-sobre');
    expect(box).not.toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(box?.textContent).toMatch(/manoel/i);
    expect(box?.textContent).toMatch(/sinasc/i);

    // a caixa publica a origem dos dados, nunca um e-mail: sair da página é pelos
    // botões ao lado
    expect(box?.textContent).not.toMatch(/@/);

    // e fecha de novo no mesmo gatilho. O `AnimatePresence` deixa o elemento
    // montado durante a animação de saída, então o que conta é o estado.
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
