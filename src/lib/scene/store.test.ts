import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENE_PARAMS,
  getSceneParams,
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
});
