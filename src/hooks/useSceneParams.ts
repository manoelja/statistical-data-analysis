/**
 * Os parâmetros vivos da cena 3D como estado do React.
 *
 * Existe porque o caminho é de **dois lados**: arrastar o histograma no corredor
 * escreve `μ`/`σ` no store (`histogram.ts` → `onDrag`), e o laboratório de
 * Probabilidade também os escreve pelos sliders. Sem esta ponte, a tela mostrava
 * dois "μ" diferentes ao mesmo tempo — o card parado enquanto a cena andava.
 *
 * `useSyncExternalStore` é o que fecha o ciclo sem polling: o store avisa quem
 * assina, e o React re-renderiza só o que leu o valor.
 */

import { useSyncExternalStore } from 'react';
import {
  getSceneParamsSnapshot,
  subscribeSceneParams,
  type SceneParams,
} from '../lib/scene/store';

export function useSceneParams(): SceneParams {
  return useSyncExternalStore(subscribeSceneParams, getSceneParamsSnapshot, getSceneParamsSnapshot);
}
