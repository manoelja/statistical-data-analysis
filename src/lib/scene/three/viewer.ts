/**
 * Renderizador da cena 3D — a única parte que fala com a GPU.
 *
 * Fica separado do `world` de propósito: assim a cena pode ser montada e
 * testada sem WebGL (o `world` só descreve objetos; quem desenha é o viewer) e,
 * se o navegador não tiver WebGL, o componente cai num aviso em vez de quebrar.
 *
 * O *bloom* é o "brilho de giz": um véu suave só nas partes claras, que faz as
 * linhas e fórmulas parecerem acesas sobre a ardósia.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export interface Viewer {
  /** desenha um quadro (a animação é avançada pelo mundo, antes) */
  render(): void;
  /** recalcula câmera e alvo do composer */
  setSize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

export interface ViewerOptions {
  /** tema escuro pede mais brilho de giz */
  dark: boolean;
}

/**
 * Devolve `null` quando não há WebGL (jsdom, navegador antigo, GPU bloqueada) —
 * o componente mostra o aviso e o resto da página continua funcionando.
 */
/** Testa a capacidade antes de construir: evita o erro do Three no console. */
export function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}

export function createViewer(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  scene: THREE.Scene,
  options: ViewerOptions,
): Viewer | null {
  if (!hasWebGL()) return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    options.dark ? 0.52 : 0.28,
    0.75,
    0.68,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let width = 1;
  let height = 1;

  const setSize = (nextWidth: number, nextHeight: number, pixelRatio: number) => {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    const ratio = Math.min(pixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.setSize(width, height);
  };

  setSize(canvas.clientWidth || 640, canvas.clientHeight || 480, window.devicePixelRatio || 1);

  return {
    render() {
      if (width < 2 || height < 2) return;
      composer.render();
    },
    setSize,
    dispose() {
      // Nada de `forceContextLoss`: a troca de tema remonta a cena no **mesmo**
      // canvas, e um contexto perdido faria o novo renderizador nascer morto
      // ("Cannot read properties of null (reading 'precision')").
      composer.dispose?.();
      renderer.dispose();
    },
  };
}
