import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CHALK_DARK, CHALK_LIGHT } from '../chalk';
import { DEFAULT_SCENE_PARAMS, resetSceneParams, setSceneParams } from '../store';
import { buildWorld, SPACING } from './world';
import type { World } from './world';

/**
 * A cena é montada em jsdom, sem WebGL: o `world` não fala com a GPU (quem
 * desenha é o `viewer`), então aqui dá para verificar o grafo de cena, a
 * animação e a interação por raio de verdade — o que costuma ser a parte que
 * só quebra no navegador.
 *
 * Sem contexto 2D, as texturas de giz viram placas vazias, mas com geometria
 * coerente: é o suficiente para conferir contagens e medidas.
 */

const created: World[] = [];

function makeWorld(): World {
  const world = buildWorld(CHALK_DARK, { ...DEFAULT_SCENE_PARAMS });
  created.push(world);
  world.setAspect(1.6);
  return world;
}

/** Avança a cena alguns quadros — o mesmo que o laço faz no navegador. */
function run(world: World, frames = 4, dt = 1 / 60) {
  for (let i = 0; i < frames; i += 1) world.advance(dt, { x: 0.1, y: -0.05 });
}

/** Simula um clique em coordenadas normalizadas da tela. */
function click(world: World, x: number, y: number): string | null {
  world.pointerDown(x, y);
  return world.pointerUp(x, y);
}

afterEach(() => {
  created.splice(0).forEach((world) => world.dispose());
  resetSceneParams();
});

describe('three/world — montagem', () => {
  it('traz os seis elementos do quadro, na ordem do corredor', () => {
    const world = makeWorld();
    expect(world.info.map((item) => item.id)).toEqual([
      'cubo',
      'histograma',
      'dispersao',
      'venn',
      'tabela',
      'dados',
    ]);
    for (const item of world.info) {
      expect(item.title.length).toBeGreaterThan(3);
      expect(item.tagline.length).toBeGreaterThan(3);
    }

    // cada exposição tem um pivô próprio, espaçados no eixo x
    const pivots = world.scene.children.filter(
      (child) => child.type === 'Group' && Math.abs(child.position.x % SPACING) < 1e-6,
    );
    expect(pivots.length).toBeGreaterThanOrEqual(6);
  });

  it('monta câmera, luzes, chão e poeira', () => {
    const world = makeWorld();
    expect(world.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(world.camera.aspect).toBeCloseTo(1.6, 6);

    let lights = 0;
    let points = 0;
    world.scene.traverse((node) => {
      if (node instanceof THREE.Light) lights += 1;
      if (node instanceof THREE.Points) points += 1;
    });
    // ambiente + direcional + dois holofotes coloridos
    expect(lights).toBeGreaterThanOrEqual(4);
    // poeira de giz + nuvem de dispersão
    expect(points).toBeGreaterThanOrEqual(2);
  });

  it('o cubo tem corpo opaco e seis faces com textura de giz', () => {
    const world = makeWorld();
    const planes: THREE.Mesh[] = [];
    let boxes = 0;
    world.scene.traverse((node) => {
      if (node instanceof THREE.Mesh && node.geometry instanceof THREE.PlaneGeometry) {
        if (node.geometry.parameters.width === node.geometry.parameters.height && node.geometry.parameters.width < 4) {
          planes.push(node);
        }
      }
      if (node instanceof THREE.Mesh && node.geometry instanceof THREE.BoxGeometry && node.geometry.parameters.width === 3) {
        boxes += 1;
      }
    });
    expect(planes.length).toBeGreaterThanOrEqual(6);
    expect(planes.every((plane) => (plane.material as THREE.MeshBasicMaterial).map !== null)).toBe(true);
    expect(boxes).toBe(1);
  });

  it('o histograma tem 11 barras e desenha a curva normal', () => {
    const world = makeWorld();
    world.focus(1);
    const bars = world.scene.children
      .flatMap((child) => child.children ?? [])
      .flatMap((child) => child.children ?? [])
      .filter(
        (node) =>
          node instanceof THREE.Mesh &&
          node.geometry instanceof THREE.BoxGeometry &&
          (node.geometry as THREE.BoxGeometry).parameters.width === 1,
      );
    expect(bars.length).toBe(11);
  });
});

describe('three/world — animação', () => {
  it('avança sem estourar e mantém as leituras coerentes em cada elemento', () => {
    const world = makeWorld();
    for (let index = 0; index < world.info.length; index += 1) {
      world.focus(index);
      run(world, 12);
      const description = world.describe();
      expect(description.index).toBe(index);
      expect(description.readout.length).toBeGreaterThanOrEqual(3);
      expect(description.formula.length).toBeGreaterThan(2);
      expect(description.explanation.length).toBeGreaterThan(40);
    }
  });

  it('a câmera voa até a exposição em foco', () => {
    const world = makeWorld();
    run(world, 30);
    const first = world.camera.position.x;
    world.focus(2);
    run(world, 90);
    expect(world.camera.position.x).toBeGreaterThan(first);
    expect(world.camera.position.x).toBeCloseTo(2 * SPACING, 0);
  });

  it('a nuvem de dispersão tem 50 pontos e um R² válido', () => {
    const world = makeWorld();
    world.focus(2);
    run(world, 20);
    const points = world.scene.getObjectByProperty('type', 'Points');
    expect(points).toBeDefined();

    const readout = world.describe().readout;
    const r2 = readout.find((item) => item.label === 'R²');
    expect(r2).toBeDefined();
    const value = Number(r2!.value);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(1);

    let dots = 0;
    world.scene.traverse((node) => {
      if (node instanceof THREE.Points && (node.geometry.getAttribute('position')?.count ?? 0) === 50) dots += 1;
    });
    expect(dots).toBe(1);
  });

  it('o Venn respeita P(A∪B) = P(A) + P(B) − P(A∩B) e reage ao arrasto', () => {
    const world = makeWorld();
    world.focus(3);
    run(world, 30);
    const read = () => world.describe().readout;
    const valueOf = (label: string) => Number(read().find((item) => item.label === label)!.value);

    const before = valueOf('P(A∩B)');
    world.pointerDown(-0.5, 0);
    world.pointerMove(0.5, 0, true);
    world.pointerUp(0.5, 0);
    run(world, 60);
    const after = valueOf('P(A∩B)');
    expect(after).not.toBeCloseTo(before, 6);

    const pA = valueOf('P(A)');
    const pB = valueOf('P(B)');
    const inter = valueOf('P(A∩B)');
    const union = valueOf('P(A∪B)');
    expect(inter).toBeLessThanOrEqual(Math.min(pA, pB) + 1e-9);
    expect(union).toBeCloseTo(pA + pB - inter, 3);
  });

  it('os dados somam entre 2 e 12 e a probabilidade acompanha a soma', () => {
    const world = makeWorld();
    world.focus(5);
    run(world, 60);
    const readout = world.describe().readout;
    const sum = Number(readout.find((item) => item.label === 'Soma')!.value);
    expect(sum).toBeGreaterThanOrEqual(2);
    expect(sum).toBeLessThanOrEqual(12);
    const probability = readout.find((item) => item.label === `P(soma = ${sum})`)!.value;
    const numeric = Number(probability.replace('%', '').replace(',', '.'));
    expect(numeric).toBeGreaterThan(2.7);
    expect(numeric).toBeLessThan(16.8);
  });

  it('a tabela pondera a média pelas frequências', () => {
    const world = makeWorld();
    world.focus(4);
    run(world, 20);
    const readout = world.describe().readout;
    const mean = Number(readout.find((item) => item.label === 'Média ponderada')!.value.replace('x̄ ≈ ', ''));
    expect(mean).toBeGreaterThan(1);
    expect(mean).toBeLessThan(5);
    expect(readout.find((item) => item.label === 'Células')!.value).toBe('5×4');
  });
});

describe('three/world — ponte com o laboratório', () => {
  it('μ e σ publicados no estado da cena aparecem no histograma 3D', () => {
    const world = makeWorld();
    world.focus(1);
    setSceneParams({ mu: 3800, sigma: 700 });
    run(world, 3);

    const readout = world.describe().readout;
    expect(readout.find((item) => item.label === 'μ (média)')!.value).toBe('3800 g');
    expect(readout.find((item) => item.label === 'σ (desvio)')!.value).toBe('700 g');

    // σ menor deixa o pico proporcionalmente mais alto
    setSceneParams({ sigma: 200 });
    run(world, 3);
    const taller = world.describe().readout.find((item) => item.label === 'Pico ∝ 1/σ')!.value;
    expect(Number(taller)).toBeGreaterThan(1.2 / 0.5);
  });

  it('arrastar no histograma publica μ/σ de volta no estado compartilhado', () => {
    const world = makeWorld();
    world.focus(1);
    run(world, 2);
    world.pointerDown(-0.5, 0);
    world.pointerMove(0.5, 0.3, true);
    world.pointerUp(0.5, 0.3);

    const readout = world.describe().readout;
    const mu = Number(readout.find((item) => item.label === 'μ (média)')!.value.replace(' g', ''));
    const sigma = Number(readout.find((item) => item.label === 'σ (desvio)')!.value.replace(' g', ''));
    expect(mu).toBeGreaterThan(DEFAULT_SCENE_PARAMS.mu);
    expect(sigma).toBeLessThan(DEFAULT_SCENE_PARAMS.sigma);
    expect(mu).toBeLessThanOrEqual(4000);
    expect(sigma).toBeGreaterThanOrEqual(100);
  });
});

describe('three/world — interação por raio', () => {
  it('acha um alvo clicável no centro da tela em cada elemento', () => {
    const world = makeWorld();
    for (let index = 0; index < world.info.length; index += 1) {
      world.focus(index);
      run(world, 40);

      let detail: string | null = null;
      for (let gx = -0.4; gx <= 0.4 && !detail; gx += 0.2) {
        for (let gy = -0.4; gy <= 0.4 && !detail; gy += 0.2) {
          detail = click(world, gx, gy);
        }
      }
      expect(detail, `elemento ${world.info[index].id} deveria ter alvo clicável`).not.toBeNull();
    }
  });

  it('clicar numa face do cubo troca o que o painel explica', () => {
    const world = makeWorld();
    world.focus(0);
    run(world, 10);
    const before = world.describe();
    expect(before.title).toBe('Cubo de fórmulas');

    // gira o cubo para trazer a face +Z (Binomial) para a frente e clica nela
    world.pointerDown(-0.6, 0);
    world.pointerMove(-0.35, 0, true);
    world.pointerUp(-0.35, 0);
    run(world, 40);
    const detail = click(world, 0, 0);
    expect(detail).toBeTruthy();
    expect(world.describe().detail).toBeTruthy();
  });

  it('arrastar gira a exposição em foco sem trocar de elemento', () => {
    const world = makeWorld();
    world.focus(0);
    run(world, 5);
    const pivot = world.scene.children.find(
      (child) => child.type === 'Group' && Math.abs(child.position.x) < 1e-6,
    )!;
    const before = pivot.rotation.y;
    world.pointerDown(0, 0);
    world.pointerMove(0.4, 0, true);
    world.pointerUp(0.4, 0);
    run(world, 5);
    expect(pivot.rotation.y).not.toBeCloseTo(before, 6);
    // arrasto não é clique: nada foi selecionado
    expect(world.describe().detail).toBeNull();
    expect(world.current()).toBe(0);
  });

  it('reset volta tudo ao primeiro elemento e religa a animação', () => {
    const world = makeWorld();
    world.focus(4);
    world.setPlaying(false);
    run(world, 10);
    world.reset();
    expect(world.current()).toBe(0);
    expect(world.playing()).toBe(true);
    expect(world.describe().index).toBe(0);
  });

  it('step dá a volta na lista nos dois sentidos', () => {
    const world = makeWorld();
    expect(world.step(-1)).toBe(world.info.length - 1);
    expect(world.step(1)).toBe(0);
  });
});

describe('three/world — tema', () => {
  it('monta com a paleta clara sem depender da escura', () => {
    const world = buildWorld(CHALK_LIGHT, { ...DEFAULT_SCENE_PARAMS });
    created.push(world);
    run(world, 3);
    expect(world.info.length).toBe(6);
    expect(world.describe().title).toBe('Cubo de fórmulas');
    expect(world.scene.fog).toBeInstanceOf(THREE.Fog);
  });
});
