/**
 * Estado vivo da cena — a **ponte** entre o conteúdo e o quadro animado.
 *
 * Os laboratórios publicam os parâmetros que o usuário ajusta nos sliders; o
 * fundo (`DataScienceBackdrop`) consome esses valores a cada quadro. É o que
 * une conteúdo e animação numa coisa só: **mexer no conteúdo muda a animação**.
 *
 * Fica fora do React de propósito — a cena lê de dentro do loop (`useRafLoop`)
 * sem provocar re-render da árvore.
 */

export interface SceneParams {
  /** μ da Normal (g) — laboratório de peso ao nascer. */
  mu: number;
  /** σ da Normal (g). */
  sigma: number;
  /** λ da Poisson (admissões/hora). */
  lambda: number;
  /** n da Binomial (equipamentos). */
  n: number;
  /** p da Binomial (probabilidade de defeito). */
  p: number;
}

export const DEFAULT_SCENE_PARAMS: SceneParams = {
  mu: 3250,
  sigma: 500,
  lambda: 4,
  n: 20,
  p: 0.02,
};

let params: SceneParams = { ...DEFAULT_SCENE_PARAMS };
const listeners = new Set<() => void>();

export function getSceneParams(): SceneParams {
  return params;
}

/** Atualiza só as chaves passadas e avisa os assinantes (se algo mudou de fato). */
export function setSceneParams(patch: Partial<SceneParams>): void {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof SceneParams)[]) {
    const value = patch[key];
    if (value !== undefined && value !== params[key]) {
      params[key] = value;
      changed = true;
    }
  }
  if (changed) listeners.forEach((listener) => listener());
}

export function subscribeSceneParams(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Restaura os valores padrão (usado nos testes). */
export function resetSceneParams(): void {
  params = { ...DEFAULT_SCENE_PARAMS };
  listeners.forEach((listener) => listener());
}
