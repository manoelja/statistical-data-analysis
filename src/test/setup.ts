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
