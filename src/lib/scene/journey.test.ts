import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CHALK_DARK, CHALK_LIGHT } from './chalk';
import { DEFAULT_SCENE_PARAMS, resetSceneParams } from './store';
import { pullAt } from './three/blackhole';
import {
  CARD_FADE,
  HOLE_CROSSING,
  HOLE_REVEAL_END,
  HOLE_Z,
  JOURNEY_CHAPTERS,
  JOURNEY_DEPTH,
  JOURNEY_LEAD,
  REWIND_SPAN,
  buildJourney,
  cardPose,
  chapterAnchor,
  chapterIndexAt,
  depthAt,
  holePhase,
  progressAt,
  prologueOpacity,
  rewindEnvelope,
  type Journey,
} from './journey';

/**
 * A jornada é montada em jsdom, sem WebGL: o `journey` só descreve objetos e
 * sabe avançar a animação (quem desenha é o `viewer`). Aqui dá para conferir o
 * grafo de cena, a coreografia dos cards e os elementos 3D reaproveitados do
 * antigo laboratório — o que costuma quebrar só no navegador.
 */

const created: Journey[] = [];

function makeJourney(dark = true): Journey {
  const journey = buildJourney(dark ? CHALK_DARK : CHALK_LIGHT, { ...DEFAULT_SCENE_PARAMS });
  created.push(journey);
  journey.setAspect(1.6);
  return journey;
}

/** Avança a cena até a câmera alcançar (quase) a profundidade pedida. */
function settle(journey: Journey, targetZ: number, frames = 240, dt = 1 / 60, pointer = { x: 0, y: 0 }): void {
  for (let i = 0; i < frames; i += 1) journey.advance(dt, targetZ, pointer);
}

/**
 * Caixas no espaço do mundo para tudo o que é **sólido** (malhas). Pontos,
 * linhas e sprites ficam de fora de propósito: a câmera pode (e deve)
 * atravessar poeira, pulsos e texto.
 *
 * A única exceção é o que está marcado com `userData.letCameraPass`: o buraco
 * negro é o ponto do percurso em que a câmera cruza uma peça de propósito, e
 * fingir que não é esconderia justamente o defeito que o teste existe para caçar.
 */
function letsCameraPass(node: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = node;
  while (current) {
    if (current.userData?.letCameraPass) return true;
    current = current.parent;
  }
  return false;
}

function solidBoxes(root: THREE.Object3D): THREE.Box3[] {
  const boxes: THREE.Box3[] = [];
  const matrix = new THREE.Matrix4();
  root.traverse((node) => {
    if (node instanceof THREE.InstancedMesh) {
      if (letsCameraPass(node)) return;
      node.geometry.computeBoundingBox();
      const geometryBox = node.geometry.boundingBox;
      if (!geometryBox) return;
      for (let index = 0; index < node.count; index += 1) {
        node.getMatrixAt(index, matrix);
        boxes.push(geometryBox.clone().applyMatrix4(matrix).applyMatrix4(node.matrixWorld));
      }
      return;
    }
    if (node instanceof THREE.Mesh) {
      if (letsCameraPass(node)) return;
      node.geometry.computeBoundingBox();
      const geometryBox = node.geometry.boundingBox;
      if (geometryBox) boxes.push(geometryBox.clone().applyMatrix4(node.matrixWorld));
    }
  });
  return boxes;
}

afterEach(() => {
  created.splice(0).forEach((journey) => journey.dispose());
  resetSceneParams();
});

describe('journey — etapas e cards', () => {
  it('tem seis etapas, na ordem do conteúdo e ordenadas por profundidade', () => {
    expect(JOURNEY_CHAPTERS).toHaveLength(6);
    expect(JOURNEY_CHAPTERS.map((chapter) => chapter.id)).toEqual([
      'visao',
      'probabilidade',
      'inferencia',
      'resultados',
      'formulario',
      'contato',
    ]);
    for (let i = 1; i < JOURNEY_CHAPTERS.length; i += 1) {
      const previous = JOURNEY_CHAPTERS[i - 1];
      const chapter = JOURNEY_CHAPTERS[i];
      expect(chapter.z).toBeLessThan(previous.z);
      expect(chapter.enter).toBeGreaterThan(previous.exit);
      expect(chapter.exit).toBeGreaterThan(chapter.enter);
      expect(chapter.enter).toBeLessThanOrEqual(1);
      expect(chapter.exit).toBeLessThanOrEqual(1);
    }
    expect(JOURNEY_CHAPTERS[JOURNEY_CHAPTERS.length - 1].exit).toBe(1);
  });

  it('nenhum card aparece durante o prólogo do buraco negro', () => {
    // a página abre no escuro: o primeiro card só entra depois da travessia
    // e depois que o disco já virou poeira
    expect(HOLE_CROSSING).toBeLessThan(HOLE_REVEAL_END);
    expect(HOLE_REVEAL_END).toBeLessThanOrEqual(JOURNEY_CHAPTERS[0].enter);
    JOURNEY_CHAPTERS.forEach((_, index) => {
      expect(cardPose(index, 0).opacity).toBe(0);
      expect(cardPose(index, HOLE_CROSSING).opacity).toBe(0);
    });
  });

  it('o card fica do lado oposto ao elemento 3D (ou centralizado)', () => {
    JOURNEY_CHAPTERS.forEach((chapter) => {
      if (chapter.cardSide === 'center') return;
      expect(chapter.cardSide).toBe(chapter.side < 0 ? 'right' : 'left');
    });
    // o último card é o painel de contato, centralizado
    expect(JOURNEY_CHAPTERS[5].cardSide).toBe('center');
  });

  it('chapterAnchor aponta para a profundidade de cada etapa', () => {
    JOURNEY_CHAPTERS.forEach((chapter, index) => {
      expect(chapterAnchor(index)).toBeCloseTo(progressAt(chapter.z), 6);
    });
    // o corredor inteiro cabe antes do fim do scroll
    expect(chapterAnchor(5)).toBeLessThan(1);
    expect(chapterAnchor(-9)).toBeCloseTo(chapterAnchor(0), 6);
    expect(chapterAnchor(99)).toBeCloseTo(chapterAnchor(5), 6);
  });

  it('depthAt e progressAt são inversos e cobrem o prólogo', () => {
    expect(depthAt(0)).toBe(JOURNEY_LEAD);
    expect(depthAt(1)).toBe(-JOURNEY_DEPTH);
    // o buraco negro fica na origem: é o ponto de partida da reta de voo
    expect(depthAt(HOLE_CROSSING)).toBeCloseTo(HOLE_Z, 6);
    [0, 0.25, 0.5, 0.87, 1].forEach((progress) => {
      expect(progressAt(depthAt(progress))).toBeCloseTo(progress, 6);
    });
    // fora da faixa, tudo é preso nas pontas
    expect(progressAt(9999)).toBe(0);
    expect(progressAt(-9999)).toBe(1);
  });

  it('holePhase descreve a queda: aproximação, clarão e revelação', () => {
    // no começo: longe, sem clarão, disco intacto
    const start = holePhase(0);
    expect(start.approach).toBe(0);
    expect(start.flare).toBeLessThan(0.01);
    expect(start.reveal).toBe(0);

    // na travessia: o clarão está subindo e o disco ainda não se abriu
    const crossing = holePhase(HOLE_CROSSING);
    expect(crossing.approach).toBeCloseTo(1, 6);
    // o ataque é centrado no horizonte: na travessia ele já está aceso
    expect(crossing.flare).toBeGreaterThan(0.2);
    expect(crossing.flare).toBeLessThan(1);
    expect(crossing.reveal).toBe(0);
    // o olhar está no buraco, não no corredor
    expect(crossing.aim).toBeCloseTo(1, 6);

    // logo depois: o clarão sustenta e a câmera já voltou ao enquadramento
    // do corredor — o "snap" fica escondido atrás do branco
    const held = holePhase(HOLE_CROSSING + 0.014);
    expect(held.flare).toBeCloseTo(1, 6);
    expect(held.approach).toBeLessThan(0.35);
    expect(held.aim).toBeLessThan(0.35);

    // o clarão nunca dá um salto e, depois de começar a cair, não volta a subir:
// sem degrau na travessia, sem degrau na virada da queda, sem oscilação.
    let previous = holePhase(0).flare;
    let previousReveal = -1;
    let falling = false;
    for (let p = 0.002; p <= 0.3; p += 0.002) {
      const phase = holePhase(p);
      const step = phase.flare - previous;
      const where = `p=${p.toFixed(3)}`;

      expect(Math.abs(step), `degrau em ${where}`).toBeLessThan(0.17);
      expect(phase.flare, `clarão em ${where}`).toBeLessThanOrEqual(1);
      expect(phase.flare, `clarão em ${where}`).toBeGreaterThanOrEqual(0);

      if (step < -0.005) falling = true;
      // já começou a cair, não pode haver subida (a não ser ruído de ~0)
      if (falling) expect(step, `oscilação em ${where}`).toBeLessThan(0.005);

      // a revelação é monótona: o disco só se abre, nunca se fecha
      expect(phase.reveal, `revelação em ${where}`).toBeGreaterThanOrEqual(previousReveal - 1e-6);
      previous = phase.flare;
      previousReveal = phase.reveal;
    }
    // e o pico aconteceu antes da revelação começar (o branco cobre o quadro)
    expect(falling).toBe(true);

    // depois: nada de disco, e o olhar volta ao corredor
    const after = holePhase(JOURNEY_CHAPTERS[0].enter);
    expect(after.reveal).toBe(1);
    expect(after.approach).toBe(0);
    expect(after.aim).toBe(0);

    // a revelação é monótona e o clarão é um pico, não uma escada
    expect(holePhase(0).reveal).toBe(0);
    expect(holePhase(HOLE_REVEAL_END).reveal).toBe(1);
    expect(holePhase(1).reveal).toBe(1);
    // só existe um pico de clarão (a travessia)
    const peaks = [0.05, 0.1, HOLE_CROSSING, 0.2, 0.3].map((p) => holePhase(p).flare);
    const best = peaks.indexOf(Math.max(...peaks));
    expect(best).toBe(2);
  });

  it('a placa do prólogo some antes do capítulo 1', () => {
    expect(prologueOpacity(0)).toBe(1);
    expect(prologueOpacity(HOLE_CROSSING)).toBe(0);
    expect(prologueOpacity(0.3)).toBe(0);
    expect(prologueOpacity(-5)).toBe(1);
  });

  it('chapterIndexAt acompanha o meio da janela de cada card', () => {
    JOURNEY_CHAPTERS.forEach((chapter, index) => {
      const middle = (chapter.enter + chapter.exit) / 2;
      expect(chapterIndexAt(middle)).toBe(index);
    });
    expect(chapterIndexAt(0)).toBe(0);
    expect(chapterIndexAt(1)).toBe(5);
  });

  it('cada card só aparece na sua janela', () => {
    // a página abre vazia (prólogo) e o painel de contato não some no fim
    expect(cardPose(0, 0).opacity).toBe(0);
    expect(cardPose(5, 1).opacity).toBe(1);
    expect(cardPose(5, 1).shift).toBe(0);

    JOURNEY_CHAPTERS.forEach((chapter, index) => {
      // no meio da janela: parado, opaco e sem escala
      const middle = cardPose(index, (chapter.enter + chapter.exit) / 2);
      expect(middle.opacity).toBe(1);
      expect(middle.shift).toBeCloseTo(0, 6);
      expect(middle.scale).toBeCloseTo(1, 6);

      // depois da janela (quando há próxima etapa) o card já saiu
      if (index < JOURNEY_CHAPTERS.length - 1) {
        const after = cardPose(index, JOURNEY_CHAPTERS[index + 1].enter);
        expect(after.opacity).toBe(0);
        expect(Math.abs(after.shift)).toBeGreaterThan(10);
      }
    });

    // quem entra depois ainda está fora, deslizando
    const before = cardPose(3, 0.2);
    expect(before.opacity).toBe(0);
    expect(Math.abs(before.shift)).toBeGreaterThan(10);
  });

  it('os cards laterais deslizam de lados opostos', () => {
    // o primeiro card já nasce no lugar; comparamos os que têm entrada animada
    const left = JOURNEY_CHAPTERS.findIndex(
      (chapter, index) => index > 0 && chapter.cardSide === 'left',
    );
    const right = JOURNEY_CHAPTERS.findIndex(
      (chapter, index) => index > 0 && chapter.cardSide === 'right',
    );
    expect(cardPose(left, JOURNEY_CHAPTERS[left].enter + CARD_FADE * 0.5).shift).toBeLessThan(0);
    expect(cardPose(right, JOURNEY_CHAPTERS[right].enter + CARD_FADE * 0.5).shift).toBeGreaterThan(0);
  });
});

describe('journey — o rebobininho', () => {
  it('o envelope puxa atr\xe1s, segura e volta', () => {
    expect(rewindEnvelope(-1)).toBe(0);
    expect(rewindEnvelope(0)).toBe(0);

    // sobe at\xe9 1
    expect(rewindEnvelope(REWIND_SPAN * 0.1)).toBeGreaterThan(0);
    // segura no meio
    expect(rewindEnvelope(REWIND_SPAN * 0.25)).toBeCloseTo(1, 6);
    expect(rewindEnvelope(REWIND_SPAN * 0.35)).toBeCloseTo(1, 6);
    // e desce at\xe9 0
    expect(rewindEnvelope(REWIND_SPAN * 0.7)).toBeLessThan(1);
    expect(rewindEnvelope(REWIND_SPAN)).toBeCloseTo(0, 6);
    expect(rewindEnvelope(REWIND_SPAN * 10)).toBe(0);

    for (let t = 0; t <= REWIND_SPAN * 1.2; t += 0.01) {
      const value = rewindEnvelope(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('ao cruzar a bola preta, a câmera recua e depois segue em frente', () => {
    const journey = makeJourney();

    // Rolagem realista pelo prólogo: ~40 unidades de profundidade por segundo,
    // o que dá tempo do rebosininho aparecer em vez de ser atropelado pelo scroll
    const steps = 1500;
    const lag: number[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const target = depthAt((i / steps) * 0.35);
      journey.advance(1 / 60, target, { x: 0, y: 0 });
      lag.push(journey.camera.position.z - target);
    }

    // O rebosininho soma um recuo ao alvo, então a câmera passa a ficar muito à
    // frente dele. Perseguindo normalmente ela fica ~6 unidades atrás; com o
    // efeito, a folga salta para mais de cem.
    expect(Math.max(...lag)).toBeGreaterThan(60);

    // e a viagem continuou: terminou muito à frente da sombra
    expect(journey.camera.position.z).toBeLessThan(HOLE_Z - 400);
  });

  it('não dispara fora do prólogo nem sem cruzar a bola', () => {
    // parado bem antes do horizonte: nunca houve travessia
    const before = makeJourney();
    const beforeTarget = depthAt(HOLE_CROSSING * 0.6);
    // primeiro deixa a câmera assentar no alvo — senão a folga medida é só a
    // acomodação inicial do amortecimento, não o efeito
    settle(before, beforeTarget);
    let worstLag = -Infinity;
    for (let i = 0; i <= 400; i += 1) {
      before.advance(1 / 60, beforeTarget, { x: 0, y: 0 });
      worstLag = Math.max(worstLag, before.camera.position.z - beforeTarget);
    }
    // só a folga normal de perseguição — nada de recuo
    expect(worstLag).toBeLessThan(20);
    expect(before.camera.position.z).toBeCloseTo(beforeTarget, 0);

    // e um salto para o capítulo 3 não pode recuar a câmera no meio do nada
    const jumped = makeJourney();
    settle(jumped, JOURNEY_CHAPTERS[2].z);
    expect(jumped.camera.position.z).toBeCloseTo(JOURNEY_CHAPTERS[2].z, 0);
  });
});

describe('journey — cena 3D', () => {
  it('monta o prólogo + a entrada + uma peça por etapa, com as luzes estratégicas', () => {
    const journey = makeJourney();

    const groups = journey.scene.children.filter((child) => child instanceof THREE.Group);
    // prólogo (buraco negro) + entrada + seis elementos do antigo laboratório
    expect(groups).toHaveLength(8);

    let lights = 0;
    let points = 0;
    let meshes = 0;
    journey.scene.traverse((node) => {
      if (node instanceof THREE.Light) lights += 1;
      if (node instanceof THREE.Points) points += 1;
      if (node instanceof THREE.Mesh) meshes += 1;
    });
    // ambiente + hemisférica + direcional + uma por etapa
    expect(lights).toBeGreaterThanOrEqual(9);
    // poeira de dados + disco de acreção + campo de estrelas
    expect(points).toBeGreaterThanOrEqual(3);
    // as peças reaproveitadas (cubo, dados, histograma, dispersão…) têm malhas
    expect(meshes).toBeGreaterThanOrEqual(10);
  });

  it('planta o buraco negro no eixo do corredor e o resto ao lado', () => {
    const journey = makeJourney();

    // o buraco fica no eixo (x = 0), ao contrário das peças (x ≠ 0)
    const hole = journey.scene.children.find(
      (child) => child instanceof THREE.Group && child.userData.letCameraPass === true,
    ) as THREE.Group;
    expect(hole).toBeDefined();
    expect(hole.position.x).toBe(0);
    expect(hole.position.z).toBe(HOLE_Z);
    // o disco é Points: a câmera atravessa a nuvem, não uma malha
    let disk = 0;
    hole.traverse((node) => {
      if (node instanceof THREE.Points) disk += 1;
    });
    expect(disk).toBeGreaterThanOrEqual(2);

    const parts = journey.scene.children.filter(
      (child) => child instanceof THREE.Group && child.position.x !== 0,
    );
    expect(parts).toHaveLength(6);
    const chapters = JOURNEY_CHAPTERS.map((chapter) => chapter.z);
    parts.forEach((part) => {
      expect(Math.abs(part.position.x)).toBeGreaterThan(10);
      expect(chapters.some((z) => Math.abs(part.position.z - (z - 36)) < 1)).toBe(true);
    });
  });

  it('a câmera parte atrás do buraco negro e desce até o plano do disco', () => {
    const journey = makeJourney();
    // partida: reta de voo, longe do horizonte
    settle(journey, depthAt(0));
    expect(journey.camera.position.z).toBeCloseTo(JOURNEY_LEAD, 0);
    expect(journey.camera.position.y).toBeCloseTo(12, 0);

    // na travessia o campo de visão abriu (a sensação de queda)
    const wide = journey.camera.fov;
    settle(journey, depthAt(HOLE_CROSSING));
    expect(journey.camera.fov).toBeGreaterThan(wide);
    // e a câmera está mais perto do disco do que do teto do corredor
    expect(journey.camera.position.y).toBeLessThan(12);

    // depois da travessia o fov volta ao valor de base
    settle(journey, depthAt(1));
    expect(journey.camera.fov).toBeCloseTo(55, 0);
  });

  it('o puxão é da animação, não do scroll, e os pontos são pequenos', () => {
    const journey = makeJourney();

    const hole = journey.scene.children.find(
      (child) => child instanceof THREE.Group && child.userData.letCameraPass === true,
    ) as THREE.Group;

    // O "lensing" foi muito tempo um sprite aditivo amarelo de 120 unidades,
    // que lia como uma bola chapada. Hoje não existe nenhum Sprite no buraco.
    let sprites = 0;
    hole.traverse((node) => {
      if (node instanceof THREE.Sprite) sprites += 1;
    });
    expect(sprites).toBe(0);

    // A poeira capturada é o segundo `Points` do grupo (o disco é o primeiro).
    const fields: THREE.Points[] = [];
    hole.traverse((node) => {
      if (node instanceof THREE.Points) fields.push(node);
    });
    expect(fields).toHaveLength(2);
    const dustUniforms = (fields[1].material as THREE.ShaderMaterial).uniforms;
    const size = () => dustUniforms.uSize.value as number;

    /**
     * Numa jornada nova, roda `frames` quadros mirando `targetZ` e devolve o
     * puxão. Cada chamada parte do zero, senão o tempo de cena acumularia e a
     * comparação seria sobre puxões em instantes diferentes.
     */
    const pullAfter = (targetZ: number, frames: number) => {
      const j = makeJourney();
      for (let i = 0; i <= frames; i += 1) j.advance(1 / 60, targetZ, { x: 0, y: 0 });
      const group = j.scene.children.find(
        (child) => child instanceof THREE.Group && child.userData.letCameraPass === true,
      ) as THREE.Group;
      const points: THREE.Points[] = [];
      group.traverse((node) => {
        if (node instanceof THREE.Points) points.push(node);
      });
      return (points[1].material as THREE.ShaderMaterial).uniforms.uPull.value as number;
    };

    // "não depende do scroll": mesmo tempo de cena, o puxão é o mesmo — tanto na
    // reta de voo do prólogo quanto já cruzando o horizonte. (As duas
    // profundidades mantêm o buraco dentro do raio de animação; fora dele a peça
    // congela de propósito, e o uniform congela junto.)
    const atStart = pullAfter(depthAt(0), 120);
    const atCrossing = pullAfter(depthAt(HOLE_CROSSING), 120);
    expect(atStart).toBeGreaterThan(0);
    expect(atStart).toBeCloseTo(atCrossing, 6);

    // "vai ficando maior": cresce com o tempo de cena, em direção a 1 sem
    // chegar lá
    expect(pullAfter(depthAt(0), 240)).toBeGreaterThan(atStart);
    expect(pullAfter(depthAt(0), 360)).toBeGreaterThan(pullAfter(depthAt(0), 240));
    expect(pullAfter(depthAt(0), 360)).toBeLessThanOrEqual(1);

    // pontos pequenos
    expect(size()).toBeLessThanOrEqual(4);
  });

  it('a poeira da página é puxada para o buraco', () => {
    const journey = makeJourney();
    const dust = journey.scene.children.find(
      (child) => child instanceof THREE.Points && (child as THREE.Points).material instanceof THREE.PointsMaterial,
    ) as THREE.Points;
    expect(dust).toBeDefined();
    const attribute = dust.geometry.getAttribute('position') as THREE.BufferAttribute;

    const nearest = () => {
      let best = Infinity;
      for (let i = 0; i < attribute.count; i += 1) {
        const x = attribute.getX(i);
        const y = attribute.getY(i);
        const z = attribute.getZ(i);
        best = Math.min(best, Math.sqrt(x * x + y * y + z * z));
      }
      return best;
    };

    // sem animação nada se move (reduced-motion): a poeira fica onde está
    journey.setPlaying(false);
    const frozen = nearest();
    for (let i = 0; i < 200; i += 1) journey.advance(1 / 60, depthAt(0), { x: 0, y: 0 });
    expect(nearest()).toBeCloseTo(frozen, 6);

    // animando, alguma poeira encosta no buraco
    journey.setPlaying(true);
    for (let i = 0; i < 400; i += 1) journey.advance(1 / 60, depthAt(0), { x: 0, y: 0 });
    expect(nearest()).toBeLessThan(frozen);
  });

  it('pullAt é a curva do puxão: cresce devagar e nunca chega a 1', () => {
    // Se o puxão fosse até 1, a poeira seria consumida em poucos segundos e o
    // buraco ficaria sem nada para puxar — o efeito morreria sozinho. O teto
    // é o que mantém o disco como fluxo permanente.
    expect(pullAt(0)).toBe(0);
    expect(pullAt(0.2)).toBe(0);

    // cresce com o tempo…
    expect(pullAt(3)).toBeGreaterThan(pullAt(1));
    expect(pullAt(10)).toBeGreaterThan(pullAt(3));
    expect(pullAt(30)).toBeGreaterThan(pullAt(10));

    // …mas satura longe de 1, mesmo depois de muito tempo parado
    const ceiling = pullAt(100_000);
    expect(ceiling).toBeLessThan(0.7);
    expect(ceiling).toBeGreaterThan(0.6);
    expect(pullAt(10_000)).toBeCloseTo(ceiling, 2);
    expect(ceiling).toBeLessThan(1);

    // negativo também não explode (o tempo nunca anda para trás)
    expect(pullAt(-50)).toBe(0);
  });

  it('o buraco continua puxando com o usuário parado', () => {
    // O alvo do scroll fica parado em `depthAt(0)` a viagem inteira: se o
    // puxão parasse, `uPull` congelaria. Ele tem que continuar subindo.
    const readPull = (j: Journey) => {
      const group = j.scene.children.find(
        (child) => child instanceof THREE.Group && child.userData.letCameraPass === true,
      ) as THREE.Group;
      const points: THREE.Points[] = [];
      group.traverse((node) => {
        if (node instanceof THREE.Points) points.push(node);
      });
      return (points[1].material as THREE.ShaderMaterial).uniforms.uPull.value as number;
    };

    const journey = makeJourney();
    const target = depthAt(0);
    const marks: number[] = [];
    for (let i = 0; i <= 900; i += 1) {
      journey.advance(1 / 60, target, { x: 0, y: 0 });
      if (i % 300 === 0) marks.push(readPull(journey));
    }

    expect(marks[1]).toBeGreaterThan(marks[0]);
    expect(marks[2]).toBeGreaterThan(marks[1]);
    // e desacelera: o ganho dos últimos 5 s é uma fração do dos primeiros 5 s
    const firstWindow = marks[1] - marks[0];
    const lastWindow = marks[3] - marks[2];
    expect(lastWindow).toBeLessThan(firstWindow / 3);
    expect(marks[3]).toBeLessThan(0.7);
  });

  it('o mouse para de sequestrar a câmera no buraco negro', () => {
    // Regressão: no prólogo a câmera desce para 3,5 unidades do plano do disco, e
    // o paralaxe do ponteiro (±2,5 em y) a levava de dentro da poeira para o
    // vazio — o topo da tela ficava preto sólido quando o mouse ia para os
    // cantos. O enquadramento do buraco tem de ser autoral.
    const at = (targetZ: number, pointer: { x: number; y: number }) => {
      const j = makeJourney();
      settle(j, targetZ, 180, 1 / 60, pointer);
      return { x: j.camera.position.x, y: j.camera.position.y };
    };
    const centred = { x: 0, y: 0 };
    const corner = { x: 1, y: 1 };

    // dentro do buraco: o ponteiro não muda quase nada
    const holeStill = at(depthAt(HOLE_CROSSING), centred);
    const holeCorner = at(depthAt(HOLE_CROSSING), corner);
    expect(Math.abs(holeCorner.x - holeStill.x)).toBeLessThan(0.5);
    expect(Math.abs(holeCorner.y - holeStill.y)).toBeLessThan(0.5);

    // no corredor: o paralaxe volta inteiro
    const corridorStill = at(depthAt(0.5), centred);
    const corridorCorner = at(depthAt(0.5), corner);
    expect(Math.abs(corridorCorner.x - corridorStill.x)).toBeGreaterThan(3);
    expect(Math.abs(corridorCorner.y - corridorStill.y)).toBeGreaterThan(1.5);
  });

it('a transição do buraco negro é a mesma em qualquer tela', () => {
    // O retrato não tem coreografia própria: o mergulho, o close no buraco, o
    // clarão e a revelação são os mesmos. Só a *base* do FOV se adapta (para o
    // corredor caber no estreito) e há um teto, senão a soma passaria de 88°.
    const pose = (aspect: number, progress: number) => {
      const j = makeJourney();
      j.setAspect(aspect);
      settle(j, depthAt(progress));
      const forward = new THREE.Vector3();
      j.camera.getWorldDirection(forward);
      return {
        y: j.camera.position.y,
        z: j.camera.position.z,
        pitch: Math.asin(-forward.y) * (180 / Math.PI),
        fov: j.camera.fov,
      };
    };

    const atStart = { wide: pose(1.6, 0), narrow: pose(0.46, 0) };
    const atBall = { wide: pose(1.6, HOLE_CROSSING), narrow: pose(0.46, HOLE_CROSSING) };

    // mergulha igual nos dois, e mergulha mesmo
    for (const shot of [atStart, atBall]) {
      expect(shot.narrow.y).toBeCloseTo(shot.wide.y, 0);
    }
    expect(atBall.wide.y).toBeLessThan(5);
    expect(atStart.wide.y).toBeCloseTo(12, 0);

    // o close no buraco é igual: as duas mergulham para o mesmo ângulo
    expect(atBall.narrow.pitch).toBeCloseTo(atBall.wide.pitch, 0);
    expect(atBall.wide.pitch).toBeGreaterThan(80);

    // e o avanço é o mesmo
    expect(atBall.narrow.z).toBeCloseTo(atBall.wide.z, 0);

    // o FOV é a única coisa que se adapta, e nunca passa do teto
    expect(atBall.narrow.fov).not.toBeCloseTo(atBall.wide.fov, 0);
    expect(atBall.wide.fov).toBeCloseTo(71, 0);
    expect(atBall.narrow.fov).toBeLessThanOrEqual(78);
  });

  it('a sombra evapora antes de virar uma parede preta', () => {
  // Regressão do mobile: a sombra é a única peça opaca do buraco e a câmera voa
  // direto nela. Com o FOV do retrato a esfera preenchia o quadro inteiro por
  // volta de 14 unidades, e se o usuário parasse de rolar ali a tela ficava
  // preta. Ela tem que se dissolver antes.
  const shadowAt = (progress: number) => {
    const j = makeJourney();
    j.setAspect(0.46);
    settle(j, depthAt(progress));
    const hole = j.scene.children.find(
      (child) => child instanceof THREE.Group && child.userData.letCameraPass === true,
    ) as THREE.Group;
    const shadow = hole.children.find(
      (child) =>
        child instanceof THREE.Mesh &&
        (child.material as THREE.MeshBasicMaterial).color.getHexString() === '000000',
    ) as THREE.Mesh;
    return {
      visible: shadow.visible,
      opacity: (shadow.material as THREE.MeshBasicMaterial).opacity,
    };
  };

  // de longe, a sombra é o âncora visual do buraco: sólida
  const far = shadowAt(0);
  expect(far.opacity).toBeCloseTo(1, 5);
  expect(far.visible).toBe(true);

  // dentro da bola, ela já evaporou — nada de parede preta
  const inside = shadowAt(HOLE_CROSSING);
  expect(inside.opacity).toBeCloseTo(0, 5);
  expect(inside.visible).toBe(false);
});

it('o campo de visão não passa do teto no retrato', () => {
    // Regressão: a base do estreito já é 72° e a aproximação somava 16°, dando
    // 88° de quadro para uma lâmina de disco — muito espaço vazio em volta.
    const j = makeJourney();
    j.setAspect(0.46);
    settle(j, depthAt(HOLE_CROSSING));
    expect(j.camera.fov).toBeLessThanOrEqual(78);
  });

  it('os véus do prólogo acompanham a fase', () => {
    const journey = makeJourney();

    // dois véus presos à câmera: o vazio (fundo preto) e o clarão (aditivo)
    const veils = journey.camera.children.filter((child) => child instanceof THREE.Mesh) as THREE.Mesh[];
    expect(veils).toHaveLength(2);
    const opacityOf = (needle: string) => {
      const veil = veils.find((mesh) => (mesh.material as THREE.MeshBasicMaterial).color.getHexString() === needle);
      expect(veil, `véu ${needle}`).toBeDefined();
      return (veil as THREE.Mesh).material as THREE.MeshBasicMaterial;
    };
    const flash = () => opacityOf('fff6e2').opacity;
    const dark = () => opacityOf('04060b').opacity;

    // no começo: vazio fechado no desktop (1,0), sem clarão
    settle(journey, depthAt(0));
    expect(dark()).toBeCloseTo(1, 5);
    expect(flash()).toBeCloseTo(0, 5);

    // na travessia: o clarão domina e o vazio ainda não abriu
    settle(journey, depthAt(HOLE_CROSSING));
    expect(flash()).toBeGreaterThan(0.2);
    expect(dark()).toBeCloseTo(1, 5);

    // no capítulo 1: vazio aberto e clarão passou
    settle(journey, depthAt(1));
    expect(dark()).toBeLessThan(0.02);
    expect(flash()).toBeLessThan(0.02);
  });

  it('a câmera percorre a profundidade conforme o alvo pedido', () => {
    const journey = makeJourney();
    settle(journey, 0);
    expect(journey.camera.position.z).toBeCloseTo(0, 0);

    settle(journey, JOURNEY_CHAPTERS[2].z);
    expect(journey.camera.position.z).toBeCloseTo(JOURNEY_CHAPTERS[2].z, 0);

    settle(journey, -JOURNEY_DEPTH);
    expect(journey.camera.position.z).toBeCloseTo(-JOURNEY_DEPTH, 0);
  });

  it('a câmera nunca atravessa uma peça sólida ao longo do percurso', () => {
    // atravessar uma peça é o tipo de defeito que só aparece no navegador:
    // as peças precisam ficar fora da rota (a câmera voa em y ≈ 12). A varredura
    // vai de `+JOURNEY_LEAD` até `-JOURNEY_DEPTH` — o prólogo incluído, porque é
    // ali que a câmera desce e o risco de colisioar é maior.
    const journey = makeJourney();
    const pointers = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: -1, y: -1 },
    ];
    const hits: string[] = [];

    for (const pointer of pointers) {
      for (let progress = 0; progress <= 1.0001; progress += 0.008) {
        settle(journey, depthAt(progress), 20, 1 / 60, pointer);
        journey.scene.updateMatrixWorld(true);
        const { x, y, z } = journey.camera.position;
        for (const box of solidBoxes(journey.scene)) {
          if (box.containsPoint(journey.camera.position)) {
            hits.push(
              `camera(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}) dentro de x[${box.min.x.toFixed(1)}, ${box.max.x.toFixed(1)}] y[${box.min.y.toFixed(1)}, ${box.max.y.toFixed(1)}] z[${box.min.z.toFixed(1)}, ${box.max.z.toFixed(1)}]`,
            );
          }
        }
      }
    }

    expect(hits).toEqual([]);
  });

  it('com o movimento reduzido, as peças congelam mas a câmera continua viajando', () => {
    const journey = makeJourney();
    journey.setPlaying(false);

    // o cubo de fórmulas é a peça da etapa "Formulário" (lado direito)
    const cubePart = journey.scene.children.find(
      (child) =>
        child instanceof THREE.Group &&
        Math.round(child.position.z) === Math.round(JOURNEY_CHAPTERS[4].z - 36),
    ) as THREE.Group;
    const cube = cubePart.children[0] as THREE.Group;
    expect(cube).toBeDefined();

    settle(journey, JOURNEY_CHAPTERS[4].z);
    expect(journey.camera.position.z).toBeCloseTo(JOURNEY_CHAPTERS[4].z, 0);
    // parado: o cubo fica no giro inicial (0,6 rad) e não avança
    expect(cube.rotation.y).toBeCloseTo(0.6, 6);

    journey.setPlaying(true);
    settle(journey, JOURNEY_CHAPTERS[4].z, 30);
    expect(cube.rotation.y).not.toBeCloseTo(0.6, 3);
  });

  it('aplica fog exponencial, tema claro/escuro e campo de visão responsivo', () => {
    const dark = makeJourney(true);
    expect(dark.scene.fog).toBeInstanceOf(THREE.FogExp2);
    const background = dark.scene.background;

    const light = makeJourney(false);
    expect(light.scene.background).not.toBe(background);

    light.setAspect(1.8);
    const wide = light.camera.fov;
    light.setAspect(0.6);
    expect(light.camera.fov).toBeGreaterThan(wide);
    expect(light.camera.aspect).toBeCloseTo(0.6, 6);
  });

  it('dispose limpa a cena', () => {
    const journey = buildJourney(CHALK_DARK, { ...DEFAULT_SCENE_PARAMS });
    expect(journey.scene.children.length).toBeGreaterThan(0);
    journey.dispose();
    expect(journey.scene.children).toHaveLength(0);
  });
});

