import '@testing-library/jest-dom';

/**
 * jsdom não implementa IntersectionObserver, usado pelo framer-motion
 * em `whileInView`. Stub mínimo para que os componentes possam montar.
 */
if (!('IntersectionObserver' in globalThis)) {
  class IntersectionObserverStub implements IntersectionObserver {
    root = null;
    rootMargin = '';
    scrollMargin = '';
    thresholds: number[] = [];

    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: IntersectionObserverStub,
    writable: true,
    configurable: true,
  });
}

/**
 * jsdom não implementa canvas: `getContext` devolveria `null` **e** cuspiria um
 * "Not implemented" a cada chamada. As texturas de giz da cena 3D já tratam a
 * ausência de contexto 2D (placa vazia, geometria coerente) — aqui só silenciamos
 * o aviso e devolvemos `null` também para o WebGL, que é o que permite testar o
 * caminho "sem cena" em vez de fingir uma GPU que não existe.
 */
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

/**
 * jsdom não implementa `scrollIntoView` (o `window.scrollTo` existe, mas não
 * rola de verdade). Definimos um no-op **configurável** para que os testes
 * possam espionar a navegação por âncora/scroll.
 */
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    value: () => undefined,
    writable: true,
    configurable: true,
  });
}

/**
 * jsdom não garante `requestAnimationFrame`, e o motor de cena (`useRafLoop`)
 * depende dele. Garantimos um fallback para os testes rodarem.
 */
if (typeof window.requestAnimationFrame !== 'function') {
  window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 16)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((handle: number) =>
    clearTimeout(handle)) as typeof window.cancelAnimationFrame;
}
