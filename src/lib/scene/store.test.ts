import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENE_PARAMS,
  getSceneParams,
  getSceneParamsSnapshot,
  resetSceneParams,
  setSceneParams,
  subscribeSceneParams,
} from './store';

describe('scene/store', () => {
  beforeEach(() => {
    resetSceneParams();
  });

  it('começa com os valores padrão (iguais aos dos sliders)', () => {
    expect(getSceneParams()).toEqual(DEFAULT_SCENE_PARAMS);
  });

  it('faz merge parcial e avisa os assinantes só quando algo muda', () => {
    let calls = 0;
    const off = subscribeSceneParams(() => {
      calls += 1;
    });

    setSceneParams({ mu: 3000 });
    expect(getSceneParams().mu).toBe(3000);
    expect(getSceneParams().sigma).toBe(DEFAULT_SCENE_PARAMS.sigma);
    expect(calls).toBe(1);

    setSceneParams({ mu: 3000 }); // mesmo valor → não avisa
    expect(calls).toBe(1);

    setSceneParams({ sigma: 600 });
    expect(calls).toBe(2);

    off();
    setSceneParams({ lambda: 5 });
    expect(calls).toBe(2);
  });

  it('reset volta aos padrões', () => {
    setSceneParams({ n: 5, p: 0.4 });
    resetSceneParams();
    expect(getSceneParams()).toEqual(DEFAULT_SCENE_PARAMS);
  });

  it('o snapshot para o React só troca de identidade quando algo muda', () => {
    // `useSyncExternalStore` compara o snapshot por referência: devolver um
    // objeto novo a cada chamada faria o React renderizar em laço
    const before = getSceneParamsSnapshot();
    expect(getSceneParamsSnapshot()).toBe(before);

    setSceneParams({ mu: 3100 });
    const after = getSceneParamsSnapshot();
    expect(after).not.toBe(before);
    expect(after.mu).toBe(3100);
    expect(after).toEqual(getSceneParams());
    // e o objeto vivo do laço 3D continua sendo o mesmo (sem alocar por quadro)
    expect(getSceneParams()).toBe(getSceneParams());
  });
});
