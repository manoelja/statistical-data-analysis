/**
 * A mesma marcação das texturas (`_{sub}`, `^{sup}`, `\\bar{x}`) virando HTML —
 * é o que deixa a fórmula do painel "Explicar" sair legível no navegador, com a
 * barra da média desenhada em CSS e não como um glifo que pode faltar na fonte.
 */

import { tokenizeChalk } from './chalkText';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Converte `f(x) = 1/(σ√2π)·e^{−…}` na mesma coisa com `<sub>`/`<sup>`. */
export function formulaToHtml(text: string): string {
  return tokenizeChalk(text)
    .map((token) => {
      const value = escapeHtml(token.value);
      switch (token.kind) {
        case 'sub':
          return `<sub>${value}</sub>`;
        case 'sup':
          return `<sup>${value}</sup>`;
        case 'bar':
          return `<span class="chalk-bar">${value}</span>`;
        default:
          return value;
      }
    })
    .join('');
}

/** Versão em texto puro (para `title`, `aria-label` e leitores de tela). */
export function formulaToText(text: string): string {
  return tokenizeChalk(text)
    .map((token) => token.value)
    .join('');
}
